begin;

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

revoke all on function public.is_school_admin()
  from public, anon, authenticated;
grant execute on function public.is_school_admin()
  to authenticated;

drop policy if exists students_admin_insert on public.students;
drop policy if exists students_admin_update on public.students;
drop policy if exists students_insert_admin on public.students;
drop policy if exists students_update_admin on public.students;
drop policy if exists students_insert_admin_or_receptionist on public.students;
drop policy if exists students_update_admin_or_receptionist on public.students;

create policy students_insert_admin
  on public.students
  for insert
  to authenticated
  with check ((select public.is_school_admin()));

create policy students_update_admin
  on public.students
  for update
  to authenticated
  using ((select public.is_school_admin()))
  with check ((select public.is_school_admin()));

revoke update (role) on public.profiles from public, anon, authenticated;
grant update (full_name) on public.profiles to authenticated;

revoke insert, update, delete on public.fee_vouchers
  from public, anon, authenticated;

create or replace function app_private.reject_future_payment_date()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if (new.payment_date at time zone 'UTC')::date >
     (statement_timestamp() at time zone 'UTC')::date then
    raise exception using
      errcode = '22023',
      message = 'Payment date cannot be in the future.';
  end if;

  return new;
end;
$function$;

revoke all on function app_private.reject_future_payment_date()
  from public, anon, authenticated;

drop trigger if exists payments_reject_future_payment_date on public.payments;
create trigger payments_reject_future_payment_date
  before insert or update of payment_date
  on public.payments
  for each row
  execute function app_private.reject_future_payment_date();

create or replace view public.fee_voucher_directory
with (security_invoker = true)
as
select
  fv.id,
  fv.student_id,
  fv.voucher_number,
  fv.fee_month,
  fv.fee_year,
  fv.total_fee,
  fv.amount_paid,
  fv.remaining_balance,
  fv.currency,
  fv.due_date,
  fv.payment_status as settlement_status,
  case
    when fv.remaining_balance = 0 then 'paid'
    when fv.due_date < (now() at time zone 'UTC')::date then 'overdue'
    else 'pending'
  end as status,
  fv.created_at,
  s.full_name as student_name,
  s.roll_number,
  s.class_id,
  s.section,
  c.class_name
from public.fee_vouchers as fv
join public.students as s
  on s.id = fv.student_id
join public.classes as c
  on c.id = s.class_id
 and c.section = s.section;

notify pgrst, 'reload schema';

commit;
