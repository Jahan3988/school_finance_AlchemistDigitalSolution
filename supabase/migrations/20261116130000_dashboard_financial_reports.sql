begin;

alter table public.payments
  drop constraint payments_voucher_currency_fkey;

alter table public.fee_vouchers
  drop constraint fee_vouchers_student_currency_fkey;

update public.students
set currency = 'PKR'
where currency <> 'PKR';

update public.fee_vouchers
set currency = 'PKR'
where currency <> 'PKR';

update public.payments
set currency = 'PKR'
where currency <> 'PKR';

alter table public.students
  alter column currency set default 'PKR';

alter table public.fee_vouchers
  alter column currency set default 'PKR';

alter table public.payments
  alter column currency set default 'PKR';

alter table public.fee_vouchers
  add constraint fee_vouchers_student_currency_fkey
  foreign key (student_id, currency)
  references public.students (id, currency)
  on update restrict
  on delete restrict;

alter table public.payments
  add constraint payments_voucher_currency_fkey
  foreign key (voucher_id, currency)
  references public.fee_vouchers (id, currency)
  on update restrict
  on delete restrict;

with payment_totals as (
  select
    payment.voucher_id,
    sum(payment.payment_amount)::numeric(12, 2) as amount_paid
  from public.payments as payment
  group by payment.voucher_id
)
update public.fee_vouchers as voucher
set amount_paid = coalesce(payment_totals.amount_paid, 0)
from (
  select
    fee_voucher.id,
    payment_totals.amount_paid
  from public.fee_vouchers as fee_voucher
  left join payment_totals
    on payment_totals.voucher_id = fee_voucher.id
) as payment_totals
where voucher.id = payment_totals.id
  and voucher.amount_paid is distinct from coalesce(payment_totals.amount_paid, 0);

create or replace function public.get_school_dashboard_summary(
  p_month integer,
  p_year integer
)
returns table (
  total_expected_fee numeric,
  total_collected_fee numeric,
  total_pending_amount numeric,
  total_overdue_amount numeric,
  defaulters_count bigint,
  total_students bigint,
  monthly_collection jsonb,
  payment_statuses jsonb,
  defaulters jsonb
)
language sql
stable
security invoker
set search_path = ''
as $function$
with params as (
  select
    pg_catalog.make_date(p_year, p_month, 1) as month_start,
    pg_catalog.make_date(p_year, p_month, 1) + interval '1 month' as next_month_start,
    (now() at time zone 'UTC')::date as today
),
monthly_buckets as (
  select (params.month_start - series.month_offset * interval '1 month')::date as month_start
  from params
  cross join pg_catalog.generate_series(0, 5) as series(month_offset)
),
monthly_totals as (
  select
    monthly_buckets.month_start,
    coalesce(sum(payment.payment_amount), 0)::numeric as amount
  from monthly_buckets
  left join public.payments as payment
    on payment.payment_date >= (monthly_buckets.month_start::timestamp at time zone 'UTC')
   and payment.payment_date < (
     (monthly_buckets.month_start + interval '1 month')::timestamp at time zone 'UTC'
   )
  group by monthly_buckets.month_start
),
voucher_statuses as (
  select
    case voucher.status
      when 'paid' then 'Paid'
      when 'overdue' then 'Overdue'
      else 'Pending'
    end as label,
    count(*)::bigint as value
  from public.fee_voucher_directory as voucher
  group by voucher.status
),
overdue_students as (
  select
    student.id as student_id,
    student.full_name as student_name,
    student.roll_number,
    school_class.class_name,
    student.section,
    count(*)::bigint as overdue_vouchers,
    sum(voucher.remaining_balance)::numeric as amount
  from public.fee_voucher_directory as voucher
  join public.students as student
    on student.id = voucher.student_id
  join public.classes as school_class
    on school_class.id = student.class_id
  cross join params
  where voucher.remaining_balance > 0
    and voucher.due_date < params.today
  group by
    student.id,
    student.full_name,
    student.roll_number,
    school_class.class_name,
    student.section
),
metrics as (
  select
    (
      select coalesce(sum(student.monthly_fee_amount), 0)::numeric
      from public.students as student
      where student.status = 'active'
    ) as total_expected_fee,
    (
      select coalesce(sum(payment.payment_amount), 0)::numeric
      from public.payments as payment
      cross join params
      where payment.payment_date >= (params.month_start::timestamp at time zone 'UTC')
        and payment.payment_date < (params.next_month_start::timestamp at time zone 'UTC')
    ) as total_collected_fee,
    (
      select coalesce(sum(voucher.remaining_balance), 0)::numeric
      from public.fee_voucher_directory as voucher
      cross join params
      where voucher.remaining_balance > 0
        and voucher.due_date >= params.today
    ) as total_pending_amount,
    (
      select coalesce(sum(voucher.remaining_balance), 0)::numeric
      from public.fee_voucher_directory as voucher
      cross join params
      where voucher.remaining_balance > 0
        and voucher.due_date < params.today
    ) as total_overdue_amount,
    (
      select count(distinct voucher.student_id)::bigint
      from public.fee_voucher_directory as voucher
      cross join params
      where voucher.remaining_balance > 0
        and voucher.due_date < params.today
    ) as defaulters_count,
    (
      select count(*)::bigint
      from public.students
    ) as total_students
)
select
  metrics.total_expected_fee,
  metrics.total_collected_fee,
  metrics.total_pending_amount,
  metrics.total_overdue_amount,
  metrics.defaulters_count,
  metrics.total_students,
  (
    select coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'month',
          pg_catalog.to_char(monthly_totals.month_start, 'Mon'),
          'amount',
          monthly_totals.amount
        )
        order by monthly_totals.month_start
      ),
      '[]'::jsonb
    )
    from monthly_totals
  ) as monthly_collection,
  (
    select coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'label',
          voucher_statuses.label,
          'value',
          voucher_statuses.value
        )
        order by case voucher_statuses.label
          when 'Paid' then 1
          when 'Overdue' then 2
          else 3
        end
      ),
      '[]'::jsonb
    )
    from voucher_statuses
  ) as payment_statuses,
  (
    select coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'studentId',
          overdue_students.student_id,
          'studentName',
          overdue_students.student_name,
          'rollNumber',
          overdue_students.roll_number,
          'className',
          overdue_students.class_name,
          'section',
          overdue_students.section,
          'overdueVouchers',
          overdue_students.overdue_vouchers,
          'amount',
          overdue_students.amount
        )
        order by overdue_students.overdue_vouchers desc, overdue_students.amount desc
      ),
      '[]'::jsonb
    )
    from (
      select *
      from overdue_students
      order by overdue_vouchers desc, amount desc
      limit 5
    ) as overdue_students
  ) as defaulters
from metrics;
$function$;

create or replace function public.get_classwise_collection_report(
  p_month integer,
  p_year integer,
  p_search text default null,
  p_class_name text default null,
  p_section text default null,
  p_payment_status text default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  class_name text,
  section text,
  student_count bigint,
  payment_count bigint,
  collected_amount numeric,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $function$
with params as (
  select
    pg_catalog.make_date(p_year, p_month, 1)::timestamp at time zone 'UTC' as month_start,
    (
      (pg_catalog.make_date(p_year, p_month, 1) + interval '1 month')::timestamp
      at time zone 'UTC'
    ) as next_month_start
),
filtered_payments as (
  select
    school_class.class_name,
    student.section,
    student.id as student_id,
    payment.id as payment_id,
    payment.payment_amount
  from public.payments as payment
  join public.fee_vouchers as fee_voucher
    on fee_voucher.id = payment.voucher_id
  join public.fee_voucher_directory as voucher
    on voucher.id = fee_voucher.id
  join public.students as student
    on student.id = fee_voucher.student_id
  join public.classes as school_class
    on school_class.id = student.class_id
  cross join params
  where payment.payment_date >= params.month_start
    and payment.payment_date < params.next_month_start
    and (
      nullif(pg_catalog.btrim(p_search), '') is null
      or student.full_name ilike '%' || pg_catalog.btrim(p_search) || '%'
      or student.roll_number ilike '%' || pg_catalog.btrim(p_search) || '%'
    )
    and (nullif(pg_catalog.btrim(p_class_name), '') is null or school_class.class_name = p_class_name)
    and (nullif(pg_catalog.btrim(p_section), '') is null or student.section = p_section)
    and (
      nullif(pg_catalog.btrim(p_payment_status), '') is null
      or voucher.status = pg_catalog.lower(pg_catalog.btrim(p_payment_status))
    )
),
class_totals as (
  select
    filtered_payments.class_name,
    filtered_payments.section,
    count(distinct filtered_payments.student_id)::bigint as student_count,
    count(filtered_payments.payment_id)::bigint as payment_count,
    sum(filtered_payments.payment_amount)::numeric as collected_amount
  from filtered_payments
  group by filtered_payments.class_name, filtered_payments.section
)
select
  class_totals.class_name,
  class_totals.section,
  class_totals.student_count,
  class_totals.payment_count,
  class_totals.collected_amount,
  count(*) over ()::bigint as total_count
from class_totals
order by class_totals.class_name, class_totals.section
limit greatest(1, least(coalesce(p_limit, 20), 100))
offset greatest(coalesce(p_offset, 0), 0);
$function$;

revoke all on function public.get_school_dashboard_summary(integer, integer)
  from public, anon, authenticated;
grant execute on function public.get_school_dashboard_summary(integer, integer)
  to authenticated;

revoke all on function public.get_classwise_collection_report(
  integer,
  integer,
  text,
  text,
  text,
  text,
  integer,
  integer
) from public, anon, authenticated;
grant execute on function public.get_classwise_collection_report(
  integer,
  integer,
  text,
  text,
  text,
  text,
  integer,
  integer
) to authenticated;

notify pgrst, 'reload schema';

commit;
