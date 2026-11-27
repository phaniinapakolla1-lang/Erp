-- Migration 013: Authoritative Student Directory View (Roll No + Department + Class + Section + Semester)
-- Safe to re-run.

create index if not exists idx_student_profiles_roll_no on public.student_profiles (roll_no);

create or replace view public.v_student_directory
with (security_invoker = true) as
select
  p.id as student_id,
  p.full_name,
  p.email,
  p.status,
  sp.roll_no,
  sp.student_code,
  sp.admission_year,
  d.code as department_code,
  d.name as department_name,
  cs.id as class_section_id,
  cs.name as class_name,
  cs.section_code,
  sem.label as semester_label
from public.profiles p
left join public.student_profiles sp on sp.user_id = p.id
left join public.departments d on d.id = p.department_id
left join public.enrollments e on e.student_id = p.id and e.is_active = true
left join public.class_sections cs on cs.id = e.class_section_id
left join public.semesters sem on sem.id = cs.semester_id
where p.role = 'student';
