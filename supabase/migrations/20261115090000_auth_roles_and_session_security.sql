begin;

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create table app_private.app_sessions (
  session_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default clock_timestamp(),
  last_activity_at timestamptz not null default clock_timestamp(),
  revoked_at timestamptz
);

create index app_sessions_user_id_idx on app_private.app_sessions (user_id);
create index app_sessions_created_at_idx on app_private.app_sessions (created_at);
alter table app_private.app_sessions enable row level security;
revoke all on table app_private.app_sessions from public, anon, authenticated;

alter table public.profiles
  alter column role set default 'teacher';

update public.profiles
set role = 'teacher'
where role = 'staff';

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('super_admin', 'admin', 'accountant', 'teacher', 'receptionist'));

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
  v_now timestamptz := clock_timestamp();
begin
  v_session_id := nullif(auth.jwt() ->> 'session_id', '')::uuid;

  if v_user_id is null or v_session_id is null then
    return false;
  end if;

  delete from app_private.app_sessions
  where created_at <= v_now - interval '8 hours';

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
  returning current_session.session_id into v_session_id;

  return v_session_id is not null;
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

create or replace function public.is_school_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.profiles as p
    where p.id = (select auth.uid())
      and p.role in ('super_admin', 'admin')
      and (select public.is_app_session_active())
  );
$function$;

create or replace function public.set_profile_role(
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $function$
begin
  if not (select public.has_school_role(array['super_admin']::text[])) then
    raise exception using errcode = '42501', message = 'Super Admin access is required.';
  end if;

  if p_user_id = auth.uid() then
    raise exception using errcode = '42501', message = 'Users cannot change their own role.';
  end if;

  if p_role not in ('super_admin', 'admin', 'accountant', 'teacher', 'receptionist') then
    raise exception using errcode = '22023', message = 'Invalid profile role.';
  end if;

  update public.profiles
  set role = p_role
  where id = p_user_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Profile not found.';
  end if;
end;
$function$;

revoke all on function public.touch_app_session() from public, anon, authenticated;
revoke all on function public.is_app_session_active() from public, anon, authenticated;
revoke all on function public.revoke_app_session() from public, anon, authenticated;
revoke all on function public.has_school_role(text[]) from public, anon, authenticated;
revoke all on function public.is_school_admin() from public, anon, authenticated;
revoke all on function public.set_profile_role(uuid, text) from public, anon, authenticated;

grant execute on function public.touch_app_session() to authenticated;
grant execute on function public.is_app_session_active() to authenticated;
grant execute on function public.revoke_app_session() to authenticated;
grant execute on function public.has_school_role(text[]) to authenticated;
grant execute on function public.is_school_admin() to authenticated;
grant execute on function public.set_profile_role(uuid, text) to authenticated;

drop policy if exists profiles_select_self_or_admin on public.profiles;
drop policy if exists profiles_admin_update on public.profiles;
drop policy if exists classes_admin_select on public.classes;
drop policy if exists classes_admin_insert on public.classes;
drop policy if exists classes_admin_update on public.classes;
drop policy if exists classes_admin_delete on public.classes;
drop policy if exists students_admin_select on public.students;
drop policy if exists students_admin_insert on public.students;
drop policy if exists students_admin_update on public.students;
drop policy if exists students_admin_delete on public.students;
drop policy if exists fee_vouchers_admin_select on public.fee_vouchers;
drop policy if exists fee_vouchers_admin_insert on public.fee_vouchers;
drop policy if exists fee_vouchers_admin_update on public.fee_vouchers;
drop policy if exists fee_vouchers_admin_delete on public.fee_vouchers;
drop policy if exists payments_admin_select on public.payments;
drop policy if exists payments_admin_insert on public.payments;
drop policy if exists payments_admin_update on public.payments;
drop policy if exists payments_admin_delete on public.payments;

create policy profiles_select_self_or_privileged
  on public.profiles
  for select
  to authenticated
  using (
    (select public.is_app_session_active())
    and (
      id = (select auth.uid())
      or (select public.has_school_role(array['super_admin', 'admin']::text[]))
    )
  );

create policy profiles_update_self_name
  on public.profiles
  for update
  to authenticated
  using (
    id = (select auth.uid())
    and (select public.is_app_session_active())
  )
  with check (
    id = (select auth.uid())
    and (select public.is_app_session_active())
  );

create policy classes_select_permitted_roles
  on public.classes
  for select
  to authenticated
  using (
    (select public.has_school_role(
      array['super_admin', 'admin', 'accountant', 'teacher', 'receptionist']::text[]
    ))
  );

create policy classes_insert_admin
  on public.classes
  for insert
  to authenticated
  with check (
    (select public.has_school_role(array['super_admin', 'admin']::text[]))
  );

create policy classes_update_admin
  on public.classes
  for update
  to authenticated
  using (
    (select public.has_school_role(array['super_admin', 'admin']::text[]))
  )
  with check (
    (select public.has_school_role(array['super_admin', 'admin']::text[]))
  );

create policy classes_delete_admin
  on public.classes
  for delete
  to authenticated
  using (
    (select public.has_school_role(array['super_admin', 'admin']::text[]))
  );

create policy students_select_permitted_roles
  on public.students
  for select
  to authenticated
  using (
    (select public.has_school_role(
      array['super_admin', 'admin', 'accountant']::text[]
    ))
  );

create policy students_insert_admin
  on public.students
  for insert
  to authenticated
  with check (
    (select public.has_school_role(array['super_admin', 'admin']::text[]))
  );

create policy students_update_admin
  on public.students
  for update
  to authenticated
  using (
    (select public.has_school_role(array['super_admin', 'admin']::text[]))
  )
  with check (
    (select public.has_school_role(array['super_admin', 'admin']::text[]))
  );

create policy students_delete_admin
  on public.students
  for delete
  to authenticated
  using (
    (select public.has_school_role(array['super_admin', 'admin']::text[]))
  );

create policy fee_vouchers_select_finance
  on public.fee_vouchers
  for select
  to authenticated
  using (
    (select public.has_school_role(
      array['super_admin', 'admin', 'accountant']::text[]
    ))
  );

create policy fee_vouchers_insert_finance
  on public.fee_vouchers
  for insert
  to authenticated
  with check (
    (select public.has_school_role(
      array['super_admin', 'admin', 'accountant']::text[]
    ))
  );

create policy fee_vouchers_update_finance
  on public.fee_vouchers
  for update
  to authenticated
  using (
    (select public.has_school_role(
      array['super_admin', 'admin', 'accountant']::text[]
    ))
  )
  with check (
    (select public.has_school_role(
      array['super_admin', 'admin', 'accountant']::text[]
    ))
  );

create policy fee_vouchers_delete_admin
  on public.fee_vouchers
  for delete
  to authenticated
  using (
    (select public.has_school_role(array['super_admin', 'admin']::text[]))
  );

create policy payments_select_finance
  on public.payments
  for select
  to authenticated
  using (
    (select public.has_school_role(
      array['super_admin', 'admin', 'accountant']::text[]
    ))
  );

create policy payments_insert_finance
  on public.payments
  for insert
  to authenticated
  with check (
    (select public.has_school_role(
      array['super_admin', 'admin', 'accountant']::text[]
    ))
  );

create policy payments_update_finance
  on public.payments
  for update
  to authenticated
  using (
    (select public.has_school_role(
      array['super_admin', 'admin', 'accountant']::text[]
    ))
  )
  with check (
    (select public.has_school_role(
      array['super_admin', 'admin', 'accountant']::text[]
    ))
  );

create policy payments_delete_admin
  on public.payments
  for delete
  to authenticated
  using (
    (select public.has_school_role(array['super_admin', 'admin']::text[]))
  );

create or replace view public.teacher_student_directory
with (security_barrier = true)
as
select
  s.id,
  s.full_name,
  s.roll_number,
  s.class_id,
  s.section,
  s.enrollment_date,
  s.status,
  s.created_at
from public.students as s
where (select public.has_school_role(array['teacher']::text[]));

create or replace view public.receptionist_student_directory
with (security_barrier = true)
as
select
  s.id,
  s.full_name,
  s.roll_number,
  s.class_id,
  s.section,
  s.guardian_contact,
  s.enrollment_date,
  s.status,
  s.created_at
from public.students as s
where (select public.has_school_role(array['receptionist']::text[]));

revoke all on table
  public.profiles,
  public.classes,
  public.students,
  public.fee_vouchers,
  public.payments
from public, anon, authenticated;

revoke update (role) on public.profiles from public, anon, authenticated;

grant select on table
  public.profiles,
  public.classes,
  public.students,
  public.fee_vouchers,
  public.payments
to authenticated;

grant update (full_name) on public.profiles to authenticated;

grant insert (class_name, section) on public.classes to authenticated;
grant update (class_name, section) on public.classes to authenticated;
grant delete on public.classes to authenticated;

grant insert (
  full_name,
  roll_number,
  class_id,
  section,
  monthly_fee_amount,
  currency,
  guardian_contact,
  enrollment_date,
  status
) on public.students to authenticated;
grant update (
  full_name,
  roll_number,
  class_id,
  section,
  monthly_fee_amount,
  guardian_contact,
  enrollment_date,
  status
) on public.students to authenticated;
grant delete on public.students to authenticated;

grant insert (
  voucher_id,
  receipt_number,
  payment_amount,
  currency,
  payment_date,
  payment_method,
  transaction_reference
) on public.payments to authenticated;
grant update (
  receipt_number,
  payment_amount,
  payment_date,
  payment_method
) on public.payments to authenticated;
grant delete on public.payments to authenticated;

grant select on public.teacher_student_directory to authenticated;
grant select on public.receptionist_student_directory to authenticated;

notify pgrst, 'reload schema';

commit;
