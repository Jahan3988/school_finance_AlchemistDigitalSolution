begin;

alter table public.payments
  add column idempotency_key uuid;

create unique index payments_idempotency_key
  on public.payments (idempotency_key)
  where idempotency_key is not null;

create sequence public.payment_receipt_number_seq;
revoke all on sequence public.payment_receipt_number_seq from public, anon, authenticated;

select pg_catalog.setval(
  'public.payment_receipt_number_seq'::pg_catalog.regclass,
  coalesce(
    max(pg_catalog.regexp_replace(receipt_number, '^RCP-[0-9]{8}-', '')::bigint),
    0
  ) + 1,
  false
)
from public.payments
where receipt_number ~ '^RCP-[0-9]{8}-[0-9]{1,18}$';

alter table public.payments
  drop constraint if exists payments_payment_method_check;

alter table public.payments
  add constraint payments_payment_method_check
  check (
    payment_method in (
      'cash',
      'bank_transfer',
      'easypaisa',
      'jazzcash',
      'card',
      'online',
      'cheque',
      'other'
    )
  );

create or replace view public.payment_receipt_directory
with (security_invoker = true)
as
select
  p.id,
  p.receipt_number,
  p.voucher_id,
  p.payment_amount,
  p.currency,
  p.payment_date,
  p.payment_method,
  p.transaction_reference,
  p.created_at,
  fv.student_id,
  fv.voucher_number,
  fv.fee_month,
  fv.fee_year,
  fv.total_fee,
  fv.amount_paid,
  fv.remaining_balance,
  fv.due_date,
  fv.status as voucher_status,
  fv.student_name,
  fv.roll_number,
  fv.class_id,
  fv.section,
  fv.class_name
from public.payments as p
join public.fee_voucher_directory as fv
  on fv.id = p.voucher_id;

revoke all on public.payment_receipt_directory from public, anon, authenticated;
grant select on public.payment_receipt_directory to authenticated;

create or replace function public.record_fee_payment(
  p_student_id uuid,
  p_voucher_id uuid,
  p_payment_amount numeric,
  p_payment_date timestamptz,
  p_payment_method text,
  p_transaction_reference text,
  p_idempotency_key uuid
)
returns table (
  payment_id uuid,
  receipt_number text,
  payment_amount numeric,
  voucher_id uuid,
  voucher_remaining_balance numeric,
  duplicate_submission boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_existing public.payments%rowtype;
  v_existing_student_id uuid;
  v_remaining_balance numeric(12, 2);
  v_payment_id uuid;
  v_receipt_number text;
  v_created boolean := false;
  v_method text := pg_catalog.lower(pg_catalog.btrim(p_payment_method));
  v_transaction_reference text := nullif(pg_catalog.btrim(p_transaction_reference), '');
begin
  if auth.uid() is null
     or not coalesce(public.is_app_session_active(), false) then
    raise exception using
      errcode = '42501',
      message = 'An active authenticated school session is required.';
  end if;

  if not exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.role in ('super_admin', 'admin', 'accountant')
  ) then
    raise exception using
      errcode = '42501',
      message = 'Only authorized finance staff can record payments.';
  end if;

  if p_student_id is null
     or p_voucher_id is null
     or p_payment_amount is null
     or p_payment_amount <= 0
     or p_payment_amount > 9999999999.99
     or p_payment_amount <> pg_catalog.round(p_payment_amount, 2)
     or p_payment_date is null
     or (p_payment_date at time zone 'UTC')::date >
       (clock_timestamp() at time zone 'UTC')::date
     or v_method is null
     or v_method not in ('cash', 'bank_transfer', 'easypaisa', 'jazzcash')
     or (
       p_transaction_reference is not null
       and pg_catalog.char_length(pg_catalog.btrim(p_transaction_reference)) > 128
     )
     or p_idempotency_key is null then
    raise exception using
      errcode = '22023',
      message = 'Payment details are invalid or the payment date is in the future.';
  end if;

  select payment.*
  into v_existing
  from public.payments as payment
  where payment.idempotency_key = p_idempotency_key;

  if found then
    select voucher.student_id, voucher.remaining_balance
    into v_existing_student_id, v_remaining_balance
    from public.fee_vouchers as voucher
    where voucher.id = v_existing.voucher_id;

    if v_existing_student_id is distinct from p_student_id
       or v_existing.voucher_id is distinct from p_voucher_id
       or v_existing.payment_amount is distinct from p_payment_amount
       or v_existing.payment_date is distinct from p_payment_date
       or v_existing.payment_method is distinct from v_method
       or v_existing.transaction_reference is distinct from v_transaction_reference then
      raise exception using
        errcode = '22023',
        message = 'This payment submission key was already used for different payment details.';
    end if;

    return query
    select
      v_existing.id,
      v_existing.receipt_number,
      v_existing.payment_amount::numeric,
      v_existing.voucher_id,
      v_remaining_balance,
      true;
    return;
  end if;

  select voucher.remaining_balance
  into v_remaining_balance
  from public.fee_vouchers as voucher
  where voucher.id = p_voucher_id
    and voucher.student_id = p_student_id
  for update;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'The selected student voucher could not be found.';
  end if;

  select payment.*
  into v_existing
  from public.payments as payment
  where payment.idempotency_key = p_idempotency_key;

  if found then
    select voucher.student_id, voucher.remaining_balance
    into v_existing_student_id, v_remaining_balance
    from public.fee_vouchers as voucher
    where voucher.id = v_existing.voucher_id;

    if v_existing_student_id is distinct from p_student_id
       or v_existing.voucher_id is distinct from p_voucher_id
       or v_existing.payment_amount is distinct from p_payment_amount
       or v_existing.payment_date is distinct from p_payment_date
       or v_existing.payment_method is distinct from v_method
       or v_existing.transaction_reference is distinct from v_transaction_reference then
      raise exception using
        errcode = '22023',
        message = 'This payment submission key was already used for different payment details.';
    end if;

    return query
    select
      v_existing.id,
      v_existing.receipt_number,
      v_existing.payment_amount::numeric,
      v_existing.voucher_id,
      v_remaining_balance,
      true;
    return;
  end if;

  if v_remaining_balance <= 0 or p_payment_amount > v_remaining_balance then
    raise exception using
      errcode = '23514',
      message = 'Payment amount exceeds the voucher remaining balance.';
  end if;

  v_receipt_number := pg_catalog.format(
    'RCP-%s-%s',
    pg_catalog.to_char(current_date, 'YYYYMMDD'),
    pg_catalog.lpad(
      pg_catalog.nextval('public.payment_receipt_number_seq'::pg_catalog.regclass)::text,
      8,
      '0'
    )
  );

  insert into public.payments as new_payment (
    voucher_id,
    receipt_number,
    payment_amount,
    currency,
    payment_date,
    payment_method,
    transaction_reference,
    idempotency_key
  )
  select
    p_voucher_id,
    v_receipt_number,
    p_payment_amount,
    voucher.currency,
    p_payment_date,
    v_method,
    v_transaction_reference,
    p_idempotency_key
  from public.fee_vouchers as voucher
  where voucher.id = p_voucher_id
    and voucher.student_id = p_student_id
  on conflict (idempotency_key) where idempotency_key is not null do nothing
  returning new_payment.id, new_payment.receipt_number
  into v_payment_id, v_receipt_number;

  v_created := found;

  if not v_created then
    select payment.*
    into v_existing
    from public.payments as payment
    where payment.idempotency_key = p_idempotency_key;

    if not found then
      raise exception using
        errcode = '23514',
        message = 'Payment could not be recorded. Please try again.';
    end if;

    select voucher.student_id, voucher.remaining_balance
    into v_existing_student_id, v_remaining_balance
    from public.fee_vouchers as voucher
    where voucher.id = v_existing.voucher_id;

    if v_existing_student_id is distinct from p_student_id
       or v_existing.voucher_id is distinct from p_voucher_id
       or v_existing.payment_amount is distinct from p_payment_amount
       or v_existing.payment_date is distinct from p_payment_date
       or v_existing.payment_method is distinct from v_method
       or v_existing.transaction_reference is distinct from v_transaction_reference then
      raise exception using
        errcode = '22023',
        message = 'This payment submission key was already used for different payment details.';
    end if;

    return query
    select
      v_existing.id,
      v_existing.receipt_number,
      v_existing.payment_amount::numeric,
      v_existing.voucher_id,
      v_remaining_balance,
      true;
    return;
  end if;

  select voucher.remaining_balance
  into v_remaining_balance
  from public.fee_vouchers as voucher
  where voucher.id = p_voucher_id;

  return query
  select
    v_payment_id,
    v_receipt_number,
    p_payment_amount,
    p_voucher_id,
    v_remaining_balance,
    false;
end;
$function$;

revoke all on function public.record_fee_payment(
  uuid,
  uuid,
  numeric,
  timestamptz,
  text,
  text,
  uuid
) from public, anon, authenticated;
grant execute on function public.record_fee_payment(
  uuid,
  uuid,
  numeric,
  timestamptz,
  text,
  text,
  uuid
) to authenticated;

revoke insert, update, delete on public.payments from public, anon, authenticated;
revoke insert (
  voucher_id,
  receipt_number,
  payment_amount,
  currency,
  payment_date,
  payment_method,
  transaction_reference
) on public.payments from public, anon, authenticated;
revoke update (
  receipt_number,
  payment_amount,
  payment_date,
  payment_method,
  transaction_reference
) on public.payments from public, anon, authenticated;
grant select on public.payments to authenticated;

notify pgrst, 'reload schema';

commit;
