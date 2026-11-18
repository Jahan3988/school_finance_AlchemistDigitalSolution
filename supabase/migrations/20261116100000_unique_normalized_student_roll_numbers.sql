begin;

create unique index students_roll_number_normalized_key
  on public.students (lower(btrim(roll_number)));

commit;
