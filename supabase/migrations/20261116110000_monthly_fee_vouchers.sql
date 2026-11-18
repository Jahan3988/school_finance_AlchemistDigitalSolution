begin;

create sequence public.fee_voucher_number_seq;
revoke all on sequence public.fee_voucher_number_seq from public, anon, authenticated;

select pg_catalog.setval(
  'public.fee_voucher_number_seq'::pg_catalog.regclass,
  coalesce(
    max(pg_catalog.regexp_replace(voucher_number, '^FV-[0-9]{6}-', '')::bigint),
    0
  ) + 1,
  false
)
from public.fee_vouchers
where voucher_number ~ '^FV-[0-9]{6}-[0-9]{1,18}$';

create index fee_vouchers_period_idx
  on public.fee_vouchers (fee_year desc, fee_month desc);

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

revoke all on public.fee_voucher_directory from public, anon, authenticated;
grant select on public.fee_voucher_directory to authenticated;

create or replace function public.generate_monthly_fee_vouchers(
  p_month smallint,
  p_year smallint,
  p_due_date date
)
returns table (
  created_count integer,
  already_generated_count integer,
  active_student_count integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_created_count integer;
  v_active_student_count integer;
begin
  if auth.uid() is null
     or not coalesce(public.is_app_session_active(), false) then
    raise exception using
      errcode = '42501',
      message = 'An active authenticated school session is required.';
  end if;

  if not exists (
    select 1
    from public.profiles as p
    where p.id = (select auth.uid())
      and p.role in ('super_admin', 'admin')
  ) then
    raise exception using
      errcode = '42501',
      message = 'Only school administrators can generate fee vouchers.';
  end if;

  if p_month is null
     or p_month not between 1 and 12
     or p_year is null
     or p_year not between 2000 and 9999
     or p_due_date is null then
    raise exception using
      errcode = '22023',
      message = 'A valid voucher month, year, and due date are required.';
  end if;

  select count(*)::integer
  into v_active_student_count
  from public.students as s
  where s.status = 'active';

  insert into public.fee_vouchers (
    student_id,
    voucher_number,
    fee_month,
    fee_year,
    total_fee,
    currency,
    due_date
  )
  select
    s.id,
    pg_catalog.format(
      'FV-%s-%s',
      pg_catalog.to_char(
        pg_catalog.make_date(p_year::integer, p_month::integer, 1),
        'YYYYMM'
      ),
      pg_catalog.lpad(
        pg_catalog.nextval('public.fee_voucher_number_seq'::pg_catalog.regclass)::text,
        8,
        '0'
      )
    ),
    p_month,
    p_year,
    s.monthly_fee_amount,
    s.currency,
    p_due_date
  from public.students as s
  where s.status = 'active'
  order by s.id
  on conflict on constraint fee_vouchers_student_period_key do nothing;

  get diagnostics v_created_count = row_count;

  return query
  select
    v_created_count,
    greatest(v_active_student_count - v_created_count, 0),
    v_active_student_count;
end;
$function$;

revoke all on function public.generate_monthly_fee_vouchers(smallint, smallint, date)
  from public, anon, authenticated;
grant execute on function public.generate_monthly_fee_vouchers(smallint, smallint, date)
  to authenticated;

notify pgrst, 'reload schema';

commit;
