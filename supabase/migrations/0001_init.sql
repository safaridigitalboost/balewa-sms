-- Balewa School Management System — Phase 1 schema
-- Multi-school (multi-tenant): every row belongs to a school_id.
-- Row Level Security keeps each school's data separate and limits what each role can see.

-- gen_random_uuid() is built into Postgres 13+ (Supabase), no extension needed.

-- ---------- Enums ----------
create type user_role as enum ('admin', 'bursar', 'teacher', 'parent');
create type school_level as enum ('daycare', 'nursery', 'primary');
create type gender as enum ('female', 'male');
create type student_status as enum ('active', 'graduated', 'left');
create type attendance_status as enum ('present', 'late', 'absent');
create type invoice_status as enum ('unpaid', 'partial', 'paid', 'cancelled');
create type payment_method as enum ('mpesa', 'mixx', 'airtel', 'bank', 'cash');
create type sms_status as enum ('queued', 'sent', 'failed');

-- ---------- Schools ----------
create table schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  reg_no text,
  phone text,
  address text,
  motto text,
  logo_url text,
  sms_sender_id text,
  created_at timestamptz not null default now()
);

-- ---------- People ----------
-- One profile per login (auth.users). Role decides what they can do.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  full_name text not null,
  phone text,
  role user_role not null,
  created_at timestamptz not null default now()
);
create index on profiles (school_id);

-- ---------- Academic calendar ----------
create table terms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  year int not null,
  name text not null,              -- e.g. "Muhula wa 3"
  starts_on date not null,
  ends_on date not null,
  is_current boolean not null default false,
  unique (school_id, year, name)
);
create unique index one_current_term_per_school on terms (school_id) where is_current;

create table classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null,              -- "Baby Class", "Std 4"
  level school_level not null,
  sort_order int not null default 0,
  class_teacher_id uuid references profiles(id) on delete set null,
  unique (school_id, name)
);

-- ---------- Students & guardians ----------
create table students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  reg_no text not null,            -- BLW-2027-0143
  first_name text not null,
  middle_name text,
  last_name text not null,
  date_of_birth date,
  gender gender,
  class_id uuid references classes(id) on delete set null,
  previous_school text,
  status student_status not null default 'active',
  admitted_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (school_id, reg_no)
);
create index on students (school_id, class_id);

create table guardians (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  full_name text not null,
  phone text not null,             -- +2557XXXXXXXX
  relationship text not null default 'Mama',
  address text,
  profile_id uuid references profiles(id) on delete set null,  -- set when the parent gets a login
  created_at timestamptz not null default now()
);
create index on guardians (school_id, phone);

create table student_guardians (
  student_id uuid not null references students(id) on delete cascade,
  guardian_id uuid not null references guardians(id) on delete cascade,
  is_primary boolean not null default true,
  primary key (student_id, guardian_id)
);

-- ---------- Fees ----------
create table fee_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  term_id uuid not null references terms(id) on delete cascade,
  level school_level not null,
  name text not null,              -- "Ada ya muhula", "Usafiri"
  amount numeric(12,0) not null check (amount >= 0)
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  term_id uuid not null references terms(id) on delete cascade,
  amount numeric(12,0) not null check (amount >= 0),
  due_date date,
  control_number text,             -- from the payment provider
  status invoice_status not null default 'unpaid',
  created_at timestamptz not null default now(),
  unique (student_id, term_id)
);
create index on invoices (school_id, term_id);

create table payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  invoice_id uuid not null references invoices(id) on delete cascade,
  amount numeric(12,0) not null check (amount > 0),
  method payment_method not null,
  reference text,                  -- provider / M-Pesa transaction id
  paid_at timestamptz not null default now(),
  recorded_by uuid references profiles(id) on delete set null,
  unique (school_id, reference)
);
create index on payments (invoice_id);

-- Keep invoice.status in step with payments
create or replace function refresh_invoice_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_invoice uuid := coalesce(new.invoice_id, old.invoice_id);
        v_paid numeric; v_amount numeric;
begin
  select amount into v_amount from invoices where id = v_invoice;
  select coalesce(sum(amount),0) into v_paid from payments where invoice_id = v_invoice;
  update invoices set status = case
      when status = 'cancelled' then 'cancelled'
      when v_paid >= v_amount then 'paid'
      when v_paid > 0 then 'partial'
      else 'unpaid' end::invoice_status
  where id = v_invoice;
  return null;
end $$;
create trigger payments_refresh_invoice after insert or update or delete on payments
for each row execute function refresh_invoice_status();

-- ---------- Attendance ----------
create table attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  date date not null default current_date,
  status attendance_status not null,
  marked_by uuid references profiles(id) on delete set null,
  marked_at timestamptz not null default now(),
  unique (student_id, date)
);
create index on attendance (school_id, date);

-- ---------- SMS log ----------
create table sms_messages (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  to_phone text not null,
  body text not null,
  purpose text,                    -- 'fee_reminder', 'absence', 'enrolment'
  status sms_status not null default 'queued',
  provider_ref text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- Reporting view ----------
create view invoice_balances with (security_invoker = true) as
select i.id as invoice_id, i.school_id, i.student_id, i.term_id, i.amount, i.due_date, i.status, i.control_number,
       coalesce(sum(p.amount), 0)::numeric(12,0) as paid,
       (i.amount - coalesce(sum(p.amount), 0))::numeric(12,0) as balance
from invoices i left join payments p on p.invoice_id = i.id
group by i.id;

-- ---------- Helpers for RLS ----------
create or replace function my_school_id() returns uuid
language sql stable security definer set search_path = public as
$$ select school_id from profiles where id = auth.uid() $$;

create or replace function my_role() returns user_role
language sql stable security definer set search_path = public as
$$ select role from profiles where id = auth.uid() $$;

create or replace function is_staff() returns boolean
language sql stable as $$ select my_role() in ('admin','bursar','teacher') $$;

-- Students a parent is linked to
create or replace function my_children() returns setof uuid
language sql stable security definer set search_path = public as $$
  select sg.student_id from student_guardians sg
  join guardians g on g.id = sg.guardian_id
  where g.profile_id = auth.uid()
$$;

-- ---------- Row Level Security ----------
alter table schools enable row level security;
alter table profiles enable row level security;
alter table terms enable row level security;
alter table classes enable row level security;
alter table students enable row level security;
alter table guardians enable row level security;
alter table student_guardians enable row level security;
alter table fee_items enable row level security;
alter table invoices enable row level security;
alter table payments enable row level security;
alter table attendance enable row level security;
alter table sms_messages enable row level security;

-- Everyone in a school can read their school, terms and classes
create policy school_read on schools for select using (id = my_school_id());
create policy school_admin_update on schools for update using (id = my_school_id() and my_role() = 'admin');

create policy profiles_read on profiles for select using (school_id = my_school_id() and (is_staff() or id = auth.uid()));
create policy profiles_admin_write on profiles for all using (school_id = my_school_id() and my_role() = 'admin')
  with check (school_id = my_school_id() and my_role() = 'admin');

create policy terms_read on terms for select using (school_id = my_school_id());
create policy terms_admin_write on terms for all using (school_id = my_school_id() and my_role() = 'admin')
  with check (school_id = my_school_id() and my_role() = 'admin');

create policy classes_read on classes for select using (school_id = my_school_id());
create policy classes_admin_write on classes for all using (school_id = my_school_id() and my_role() = 'admin')
  with check (school_id = my_school_id() and my_role() = 'admin');

-- Students: staff see all in their school, parents only their children
create policy students_read on students for select
  using (school_id = my_school_id() and (is_staff() or id in (select my_children())));
create policy students_write on students for all
  using (school_id = my_school_id() and my_role() in ('admin','bursar'))
  with check (school_id = my_school_id() and my_role() in ('admin','bursar'));

create policy guardians_read on guardians for select
  using (school_id = my_school_id() and (is_staff() or profile_id = auth.uid()));
create policy guardians_write on guardians for all
  using (school_id = my_school_id() and my_role() in ('admin','bursar'))
  with check (school_id = my_school_id() and my_role() in ('admin','bursar'));

create policy sg_read on student_guardians for select
  using (student_id in (select id from students));  -- inherits students policy
create policy sg_write on student_guardians for all
  using (my_role() in ('admin','bursar') and student_id in (select id from students))
  with check (my_role() in ('admin','bursar') and student_id in (select id from students));

-- Fees: admin/bursar manage; teachers don't see money; parents see their children's
create policy fee_items_read on fee_items for select using (school_id = my_school_id());
create policy fee_items_write on fee_items for all
  using (school_id = my_school_id() and my_role() in ('admin','bursar'))
  with check (school_id = my_school_id() and my_role() in ('admin','bursar'));

create policy invoices_read on invoices for select
  using (school_id = my_school_id() and (my_role() in ('admin','bursar') or student_id in (select my_children())));
create policy invoices_write on invoices for all
  using (school_id = my_school_id() and my_role() in ('admin','bursar'))
  with check (school_id = my_school_id() and my_role() in ('admin','bursar'));

create policy payments_read on payments for select
  using (school_id = my_school_id() and (my_role() in ('admin','bursar')
         or invoice_id in (select id from invoices where student_id in (select my_children()))));
create policy payments_write on payments for insert
  with check (school_id = my_school_id() and my_role() in ('admin','bursar'));

-- Attendance: staff read; teachers/admin write; parents read their children's
create policy attendance_read on attendance for select
  using (school_id = my_school_id() and (is_staff() or student_id in (select my_children())));
create policy attendance_write on attendance for all
  using (school_id = my_school_id() and my_role() in ('admin','teacher'))
  with check (school_id = my_school_id() and my_role() in ('admin','teacher'));

create policy sms_read on sms_messages for select using (school_id = my_school_id() and my_role() in ('admin','bursar'));
create policy sms_insert on sms_messages for insert with check (school_id = my_school_id() and is_staff());

-- ---------- Registration number generator ----------
create or replace function next_reg_no(p_school uuid, p_year int) returns text
language plpgsql security definer set search_path = public as $$
declare v_prefix text; v_n int;
begin
  if p_school is distinct from my_school_id() then raise exception 'not allowed'; end if;
  select upper(left(slug, 3)) into v_prefix from schools where id = p_school;
  select count(*) + 1 into v_n from students where school_id = p_school and reg_no like v_prefix || '-' || p_year || '-%';
  return v_prefix || '-' || p_year || '-' || lpad(v_n::text, 4, '0');
end $$;
