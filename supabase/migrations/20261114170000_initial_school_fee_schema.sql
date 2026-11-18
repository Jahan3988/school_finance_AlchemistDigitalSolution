begin;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null
    check (char_length(btrim(full_name)) between 1 and 160),
  role text not null default 'staff'
    check (role in ('admin', 'staff')),
  created_at timestamptz not null default now()
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  class_name text not null
    check (char_length(btrim(class_name)) between 1 and 80),
  section text not null
    check (char_length(btrim(section)) between 1 and 40),
  created_at timestamptz not null default now(),
  constraint classes_name_section_key unique (class_name, section),
  constraint classes_id_section_key unique (id, section)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null
    check (char_length(btrim(full_name)) between 1 and 160),
  roll_number text not null
    check (char_length(btrim(roll_number)) between 1 and 40),
  class_id uuid not null,
  section text not null
    check (char_length(btrim(section)) between 1 and 40),
  monthly_fee_amount numeric(12, 2) not null default 0
    check (monthly_fee_amount >= 0),
  currency text not null default 'PKR'
    check (currency ~ '^[A-Z]{3}$'),
  guardian_contact text not null
    check (char_length(btrim(guardian_contact)) between 1 and 80),
  enrollment_date date not null default current_date,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  constraint students_roll_number_key unique (roll_number),
  constraint students_id_currency_key unique (id, currency),
  constraint students_class_section_fkey
    foreign key (class_id, section)
    references public.classes (id, section)
    on update cascade
    on delete restrict
);

create table public.fee_vouchers (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  voucher_number text not null
    check (char_length(btrim(voucher_number)) between 1 and 64),
  fee_month smallint not null check (fee_month between 1 and 12),
  fee_year smallint not null check (fee_year between 2000 and 9999),
  total_fee numeric(12, 2) not null check (total_fee >= 0),
  amount_paid numeric(12, 2) not null default 0
    check (amount_paid >= 0 and amount_paid <= total_fee),
  remaining_balance numeric(12, 2)
    generated always as (total_fee - amount_paid) stored,
  currency text not null default 'PKR'
    check (currency ~ '^[A-Z]{3}$'),
  due_date date not null,
  payment_status text
    generated always as (
      case
        when total_fee = 0 or amount_paid = total_fee then 'paid'
        when amount_paid = 0 then 'unpaid'
        else 'partially_paid'
      end
    ) stored,
  created_at timestamptz not null default now(),
  constraint fee_vouchers_voucher_number_key unique (voucher_number),
  constraint fee_vouchers_student_period_key
    unique (student_id, fee_year, fee_month),
  constraint fee_vouchers_id_currency_key unique (id, currency),
  constraint fee_vouchers_student_currency_fkey
    foreign key (student_id, currency)
    references public.students (id, currency)
    on update restrict
    on delete restrict
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null,
  receipt_number text not null
    check (char_length(btrim(receipt_number)) between 1 and 64),
  payment_amount numeric(12, 2) not null check (payment_amount > 0),
  currency text not null default 'PKR'
    check (currency ~ '^[A-Z]{3}$'),
  payment_date timestamptz not null default now(),
  payment_method text not null
    check (payment_method in ('cash', 'bank_transfer', 'card', 'online', 'cheque', 'other')),
  transaction_reference text
    check (
      transaction_reference is null
      or char_length(btrim(transaction_reference)) between 1 and 128
    ),
  created_at timestamptz not null default now(),
  constraint payments_receipt_number_key unique (receipt_number),
  constraint payments_voucher_currency_fkey
    foreign key (voucher_id, currency)
    references public.fee_vouchers (id, currency)
    on update restrict
    on delete restrict
);

create index profiles_role_idx
  on public.profiles (role);

create index students_class_section_idx
  on public.students (class_id, section);

create index students_full_name_idx
  on public.students (full_name);

create index students_status_idx
  on public.students (status);

create index fee_vouchers_student_period_idx
  on public.fee_vouchers (student_id, fee_year desc, fee_month desc);

create index fee_vouchers_due_date_outstanding_idx
  on public.fee_vouchers (due_date)
  where remaining_balance > 0;

create index fee_vouchers_payment_status_idx
  on public.fee_vouchers (payment_status);

create index payments_voucher_date_idx
  on public.payments (voucher_id, payment_date desc);

create index payments_payment_date_idx
  on public.payments (payment_date desc);

create unique index payments_transaction_reference_key
  on public.payments (transaction_reference)
  where transaction_reference is not null;

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
      and p.role = 'admin'
  );
$function$;

revoke all on function public.is_school_admin() from public, anon, authenticated;
grant execute on function public.is_school_admin() to authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_full_name text;
begin
  v_full_name := left(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    160
  );

  if v_full_name is null then
    v_full_name := coalesce(
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'School user'
    );
  end if;

  insert into public.profiles (id, full_name)
  values (new.id, v_full_name)
  on conflict (id) do nothing;

  return new;
end;
$function$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create or replace function public.sync_fee_voucher_amount_paid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_old_voucher_id uuid;
  v_new_voucher_id uuid;
  v_old_amount numeric(12, 2) := 0;
  v_new_amount numeric(12, 2) := 0;
  v_delta numeric(12, 2);
begin
  if tg_op <> 'INSERT' then
    v_old_voucher_id := old.voucher_id;
    v_old_amount := old.payment_amount;
  end if;

  if tg_op <> 'DELETE' then
    v_new_voucher_id := new.voucher_id;
    v_new_amount := new.payment_amount;
  end if;

  perform fv.id
  from public.fee_vouchers as fv
  where fv.id in (v_old_voucher_id, v_new_voucher_id)
  order by fv.id
  for update;

  if v_old_voucher_id is not null
     and v_old_voucher_id = v_new_voucher_id then
    v_delta := v_new_amount - v_old_amount;

    if v_delta <> 0 then
      update public.fee_vouchers as fv
      set amount_paid = fv.amount_paid + v_delta
      where fv.id = v_old_voucher_id
        and fv.amount_paid + v_delta between 0 and fv.total_fee;

      if not found then
        raise exception using
          errcode = '23514',
          message = 'Payment change exceeds the voucher balance.';
      end if;
    end if;
  else
    if v_old_voucher_id is not null then
      update public.fee_vouchers as fv
      set amount_paid = fv.amount_paid - v_old_amount
      where fv.id = v_old_voucher_id
        and fv.amount_paid >= v_old_amount;

      if not found then
        raise exception using
          errcode = '23514',
          message = 'Could not reconcile the previous voucher balance.';
      end if;
    end if;

    if v_new_voucher_id is not null then
      update public.fee_vouchers as fv
      set amount_paid = fv.amount_paid + v_new_amount
      where fv.id = v_new_voucher_id
        and fv.amount_paid + v_new_amount <= fv.total_fee;

      if not found then
        raise exception using
          errcode = '23514',
          message = 'Payment amount exceeds the voucher remaining balance.';
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$function$;

revoke all on function public.sync_fee_voucher_amount_paid() from public, anon, authenticated;

create trigger sync_fee_voucher_amount_paid
  after insert or update of voucher_id, payment_amount or delete
  on public.payments
  for each row execute function public.sync_fee_voucher_amount_paid();

alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.fee_vouchers enable row level security;
alter table public.payments enable row level security;

create policy profiles_select_self_or_admin
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()) or (select public.is_school_admin()));

create policy profiles_admin_update
  on public.profiles
  for update
  to authenticated
  using ((select public.is_school_admin()))
  with check ((select public.is_school_admin()));

create policy classes_admin_select
  on public.classes
  for select
  to authenticated
  using ((select public.is_school_admin()));

create policy classes_admin_insert
  on public.classes
  for insert
  to authenticated
  with check ((select public.is_school_admin()));

create policy classes_admin_update
  on public.classes
  for update
  to authenticated
  using ((select public.is_school_admin()))
  with check ((select public.is_school_admin()));

create policy classes_admin_delete
  on public.classes
  for delete
  to authenticated
  using ((select public.is_school_admin()));

create policy students_admin_select
  on public.students
  for select
  to authenticated
  using ((select public.is_school_admin()));

create policy students_admin_insert
  on public.students
  for insert
  to authenticated
  with check ((select public.is_school_admin()));

create policy students_admin_update
  on public.students
  for update
  to authenticated
  using ((select public.is_school_admin()))
  with check ((select public.is_school_admin()));

create policy students_admin_delete
  on public.students
  for delete
  to authenticated
  using ((select public.is_school_admin()));

create policy fee_vouchers_admin_select
  on public.fee_vouchers
  for select
  to authenticated
  using ((select public.is_school_admin()));

create policy fee_vouchers_admin_insert
  on public.fee_vouchers
  for insert
  to authenticated
  with check ((select public.is_school_admin()));

create policy fee_vouchers_admin_update
  on public.fee_vouchers
  for update
  to authenticated
  using ((select public.is_school_admin()))
  with check ((select public.is_school_admin()));

create policy fee_vouchers_admin_delete
  on public.fee_vouchers
  for delete
  to authenticated
  using ((select public.is_school_admin()));

create policy payments_admin_select
  on public.payments
  for select
  to authenticated
  using ((select public.is_school_admin()));

create policy payments_admin_insert
  on public.payments
  for insert
  to authenticated
  with check ((select public.is_school_admin()));

create policy payments_admin_update
  on public.payments
  for update
  to authenticated
  using ((select public.is_school_admin()))
  with check ((select public.is_school_admin()));

create policy payments_admin_delete
  on public.payments
  for delete
  to authenticated
  using ((select public.is_school_admin()));

grant usage on schema public to authenticated;

revoke all on table
  public.profiles,
  public.classes,
  public.students,
  public.fee_vouchers,
  public.payments
from public, anon, authenticated;

grant select on table
  public.profiles,
  public.classes,
  public.students,
  public.fee_vouchers,
  public.payments
to authenticated;

grant update (full_name, role) on public.profiles to authenticated;

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
  student_id,
  voucher_number,
  fee_month,
  fee_year,
  total_fee,
  currency,
  due_date
) on public.fee_vouchers to authenticated;
grant update (voucher_number, total_fee, due_date)
  on public.fee_vouchers to authenticated;
grant delete on public.fee_vouchers to authenticated;

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
  payment_method,
  transaction_reference
) on public.payments to authenticated;
grant delete on public.payments to authenticated;

commit;
