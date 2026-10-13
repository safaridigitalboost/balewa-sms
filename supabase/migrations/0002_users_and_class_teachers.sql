-- Balewa — 0002: user management + teachers limited to their assigned classes.
-- Run in Supabase SQL Editor AFTER 0001_init.sql. Safe to run once on an existing database.

-- ---------- Accounts can be switched off ----------
alter table profiles add column if not exists active boolean not null default true;
alter table profiles add column if not exists email text;

-- A disabled account loses all data access: the helpers return null for it.
create or replace function my_school_id() returns uuid
language sql stable security definer set search_path = public as
$$ select school_id from profiles where id = auth.uid() and active $$;

create or replace function my_role() returns user_role
language sql stable security definer set search_path = public as
$$ select role from profiles where id = auth.uid() and active $$;

-- ---------- Teacher ↔ class assignments ----------
create table if not exists class_teachers (
  school_id uuid not null references schools(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  teacher_id uuid not null references profiles(id) on delete cascade,
  is_class_teacher boolean not null default false,   -- the main (homeroom) teacher
  created_at timestamptz not null default now(),
  primary key (class_id, teacher_id)
);
create index if not exists class_teachers_teacher on class_teachers (teacher_id);

-- Carry over anyone already set as class teacher
insert into class_teachers (school_id, class_id, teacher_id, is_class_teacher)
select school_id, id, class_teacher_id, true from classes where class_teacher_id is not null
on conflict do nothing;

-- Classes the signed-in teacher is assigned to
create or replace function my_classes() returns setof uuid
language sql stable security definer set search_path = public as
$$ select class_id from class_teachers where teacher_id = auth.uid() $$;

-- Students the signed-in user may see as staff: everyone for admin/bursar, own classes for teachers
create or replace function my_staff_students() returns setof uuid
language sql stable security definer set search_path = public as $$
  select s.id from students s
  where s.school_id = my_school_id()
    and (my_role() in ('admin','bursar') or (my_role() = 'teacher' and s.class_id in (select my_classes())))
$$;

alter table class_teachers enable row level security;
drop policy if exists ct_read on class_teachers;
create policy ct_read on class_teachers for select
  using (school_id = my_school_id() and (my_role() in ('admin','bursar') or teacher_id = auth.uid()));
drop policy if exists ct_admin_write on class_teachers;
create policy ct_admin_write on class_teachers for all
  using (school_id = my_school_id() and my_role() = 'admin')
  with check (school_id = my_school_id() and my_role() = 'admin');

-- ---------- Tighten teacher visibility ----------
-- Classes: teachers see only their own; everyone else sees all
drop policy if exists classes_read on classes;
create policy classes_read on classes for select
  using (school_id = my_school_id() and (my_role() <> 'teacher' or id in (select my_classes())));

-- Students
drop policy if exists students_read on students;
create policy students_read on students for select
  using (school_id = my_school_id() and (id in (select my_staff_students()) or id in (select my_children())));

-- Guardians: teachers only see parents of their own pupils
drop policy if exists guardians_read on guardians;
create policy guardians_read on guardians for select
  using (school_id = my_school_id() and (
    my_role() in ('admin','bursar')
    or profile_id = auth.uid()
    or (my_role() = 'teacher' and id in (select guardian_id from student_guardians where student_id in (select my_staff_students())))
  ));

-- Attendance: teachers read and mark only their classes, and only pupils who are in that class
drop policy if exists attendance_read on attendance;
create policy attendance_read on attendance for select
  using (school_id = my_school_id() and (student_id in (select my_staff_students()) or student_id in (select my_children())));
drop policy if exists attendance_write on attendance;
create policy attendance_write on attendance for all
  using (school_id = my_school_id() and (my_role() = 'admin' or (my_role() = 'teacher' and class_id in (select my_classes()))))
  with check (
    school_id = my_school_id()
    and (my_role() = 'admin' or (my_role() = 'teacher' and class_id in (select my_classes())))
    and exists (select 1 from students s where s.id = student_id and s.class_id = attendance.class_id)
  );

-- Profiles: teachers see colleagues' names but parents' details stay with admin/bursar
drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles for select
  using (school_id = my_school_id() and (id = auth.uid() or my_role() in ('admin','bursar') or (my_role() = 'teacher' and role <> 'parent')));
