begin;

alter table public.profiles
  add column is_active boolean not null default true;

create table public.school_settings (
  id smallint primary key default 1 check (id = 1),
  theme_mode text not null default 'system'
    check (theme_mode in ('light', 'dark', 'system')),
  updated_at timestamptz not null default now()
);

insert into public.school_settings (id, theme_mode)
values (1, 'system')
on conflict (id) do nothing;

create or replace function public.has_school_role(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    (select public.is_app_session_active())
    and exists (
      select 1
      from public.profiles as p
      where p.id = (select auth.uid())
        and p.role = any (p_roles)
    );
$function$;

revoke all on function public.has_school_role(text[]) from public, anon, authenticated;
grant execute on function public.has_school_role(text[]) to authenticated;

alter table public.school_settings enable row level security;

revoke all on table public.school_settings from public, anon, authenticated;
grant select on public.school_settings to authenticated;
grant update (theme_mode, updated_at) on public.school_settings to authenticated;

create policy school_settings_select_authenticated
  on public.school_settings
  for select
  to authenticated
  using (
    (select public.has_school_role(
      array['super_admin', 'admin', 'accountant', 'teacher', 'receptionist']::text[]
    ))
  );

create policy school_settings_update_admin
  on public.school_settings
  for update
  to authenticated
  using (
    (select public.has_school_role(array['super_admin', 'admin']::text[]))
  )
  with check (
    (select public.has_school_role(array['super_admin', 'admin']::text[]))
  );

create or replace function public.is_app_session_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from app_private.app_sessions as s
    join public.profiles as p on p.id = s.user_id and p.is_active
    where s.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
      and s.user_id = (select auth.uid())
      and s.revoked_at is null
      and s.created_at > now() - interval '8 hours'
      and s.last_activity_at > now() - interval '30 minutes'
      and exists (
        select 1
        from auth.sessions as auth_session
        where auth_session.id = s.session_id
          and auth_session.user_id = s.user_id
          and auth_session.created_at > now() - interval '8 hours'
      )
  );
$function$;

create or replace function public.admin_set_staff_role(
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_target_role text;
begin
  if not (select public.has_school_role(array['super_admin', 'admin']::text[])) then
    raise exception using errcode = '42501', message = 'School administrator access is required.';
  end if;

  if p_user_id = (select auth.uid()) then
    raise exception using errcode = '42501', message = 'Administrators cannot change their own role.';
  end if;

  if p_role not in ('admin', 'accountant', 'teacher', 'receptionist') then
    raise exception using errcode = '22023', message = 'Invalid staff role.';
  end if;

  select role into v_target_role
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Staff profile not found.';
  end if;

  if v_target_role = 'super_admin' then
    raise exception using errcode = '42501', message = 'Super Admin profiles are protected.';
  end if;

  if v_target_role = 'admin'
     and p_role <> 'admin'
     and not exists (
       select 1
       from public.profiles
       where role = 'admin'
         and is_active
         and id <> p_user_id
     ) then
    raise exception using errcode = '42501', message = 'At least one active administrator must remain.';
  end if;

  update public.profiles
  set role = p_role
  where id = p_user_id;
end;
$function$;

create or replace function public.admin_set_staff_active(
  p_user_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_target_role text;
begin
  if not (select public.has_school_role(array['super_admin', 'admin']::text[])) then
    raise exception using errcode = '42501', message = 'School administrator access is required.';
  end if;

  if p_user_id = (select auth.uid()) then
    raise exception using errcode = '42501', message = 'Administrators cannot change their own access.';
  end if;

  select role into v_target_role
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Staff profile not found.';
  end if;

  if v_target_role = 'super_admin' then
    raise exception using errcode = '42501', message = 'Super Admin profiles are protected.';
  end if;

  if v_target_role = 'admin'
     and not p_is_active
     and (select count(*) from public.profiles where role = 'admin' and is_active) <= 1 then
    raise exception using errcode = '42501', message = 'At least one active administrator must remain.';
  end if;

  update public.profiles
  set is_active = p_is_active
  where id = p_user_id;

  if not p_is_active then
    update app_private.app_sessions
    set revoked_at = coalesce(revoked_at, clock_timestamp())
    where user_id = p_user_id
      and revoked_at is null;
  end if;
end;
$function$;

revoke all on function public.admin_set_staff_role(uuid, text) from public, anon, authenticated;
revoke all on function public.admin_set_staff_active(uuid, boolean) from public, anon, authenticated;
grant execute on function public.admin_set_staff_role(uuid, text) to authenticated;
grant execute on function public.admin_set_staff_active(uuid, boolean) to authenticated;

do $publication$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'school_settings'
  ) then
    alter publication supabase_realtime add table public.school_settings;
  end if;
end;
$publication$;

notify pgrst, 'reload schema';

commit;
