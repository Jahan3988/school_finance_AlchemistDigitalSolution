begin;

alter table public.payments
  drop constraint if exists payments_voucher_currency_fkey;

alter table public.fee_vouchers
  drop constraint if exists fee_vouchers_student_currency_fkey;

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

notify pgrst, 'reload schema';

commit;
