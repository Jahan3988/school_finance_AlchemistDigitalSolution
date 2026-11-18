begin;

create schema if not exists app_private;

create table if not exists app_private.app_sessions (
  session_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null,
  last_activity_at timestamptz not null,
  revoked_at timestamptz
);

create index if not exists app_sessions_user_id_idx
  on app_private.app_sessions (user_id);
create index if not exists app_sessions_created_at_idx
  on app_private.app_sessions (created_at);

alter table app_private.app_sessions enable row level security;
revoke all on table app_private.app_sessions from public, anon, authenticated;

create or replace function public.touch_app_session()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_session_created_at timestamptz;
  v_touched_session_id uuid;
  v_now timestamptz := clock_timestamp();
begin
  v_session_id := nullif(auth.jwt() ->> 'session_id', '')::uuid;

  if v_user_id is null or v_session_id is null then
    return false;
  end if;

  select s.created_at
  into v_session_created_at
  from auth.sessions as s
  where s.id = v_session_id
    and s.user_id = v_user_id;

  if v_session_created_at is null
     or v_session_created_at > v_now
     or v_session_created_at <= v_now - interval '8 hours' then
    return false;
  end if;

  delete from app_private.app_sessions as old_session
  where old_session.user_id = v_user_id
    and old_session.created_at <= v_now - interval '8 hours';

  insert into app_private.app_sessions as current_session (
    session_id,
    user_id,
    created_at,
    last_activity_at
  )
  values (v_session_id, v_user_id, v_session_created_at, v_now)
  on conflict (session_id) do update
    set last_activity_at = excluded.last_activity_at
    where current_session.user_id = v_user_id
      and current_session.revoked_at is null
      and current_session.created_at > v_now - interval '8 hours'
      and current_session.last_activity_at > v_now - interval '30 minutes'
  returning current_session.session_id into v_touched_session_id;

  return v_touched_session_id is not null;
end;
$function$;

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

create or replace function public.revoke_app_session()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_session_id uuid;
begin
  v_session_id := nullif(auth.jwt() ->> 'session_id', '')::uuid;

  if auth.uid() is null or v_session_id is null then
    return false;
  end if;

  update app_private.app_sessions
  set revoked_at = coalesce(revoked_at, clock_timestamp())
  where session_id = v_session_id
    and user_id = auth.uid();

  return true;
end;
$function$;

revoke all on function public.touch_app_session() from public, anon, authenticated;
revoke all on function public.is_app_session_active() from public, anon, authenticated;
revoke all on function public.revoke_app_session() from public, anon, authenticated;

grant execute on function public.touch_app_session() to authenticated;
grant execute on function public.is_app_session_active() to authenticated;
grant execute on function public.revoke_app_session() to authenticated;

alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.fee_vouchers enable row level security;
alter table public.payments enable row level security;

create policy app_session_guard_profiles
  on public.profiles
  as restrictive
  for all
  to authenticated
  using ((select public.is_app_session_active()))
  with check ((select public.is_app_session_active()));

create policy app_session_guard_classes
  on public.classes
  as restrictive
  for all
  to authenticated
  using ((select public.is_app_session_active()))
  with check ((select public.is_app_session_active()));

create policy app_session_guard_students
  on public.students
  as restrictive
  for all
  to authenticated
  using ((select public.is_app_session_active()))
  with check ((select public.is_app_session_active()));

create policy app_session_guard_fee_vouchers
  on public.fee_vouchers
  as restrictive
  for all
  to authenticated
  using ((select public.is_app_session_active()))
  with check ((select public.is_app_session_active()));

create policy app_session_guard_payments
  on public.payments
  as restrictive
  for all
  to authenticated
  using ((select public.is_app_session_active()))
  with check ((select public.is_app_session_active()));

notify pgrst, 'reload schema';

commit;
