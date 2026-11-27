-- Migration 018: P1-P3 Upgrades — Theory/Practical Subject Type & Syllabus Coverage Tracker
-- Safe to re-run.

-- 1. Theory / Practical classification on subjects
alter table public.subjects
  add column if not exists subject_type text not null default 'theory'
  check (subject_type in ('theory', 'practical'));

-- 2. Syllabus units & topic coverage tracker
create table if not exists public.syllabus_topics (
  id uuid primary key default gen_random_uuid(),
  teaching_assignment_id uuid not null references public.teaching_assignments(id) on delete cascade,
  unit_title text not null,
  topic_title text not null,
  planned_periods int not null default 2 check (planned_periods > 0),
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed', 'revised')),
  completed_date date,
  notes text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.syllabus_topics enable row level security;

drop policy if exists "syllabus_select" on public.syllabus_topics;
create policy "syllabus_select" on public.syllabus_topics
for select to authenticated using (
  public.is_approved_user()
  and (
    public.current_user_role() = 'admin'
    or exists (
      select 1 from public.teaching_assignments ta
      where ta.id = syllabus_topics.teaching_assignment_id
        and (
          ta.faculty_id = auth.uid()
          or exists (select 1 from public.enrollments e where e.student_id = auth.uid() and e.class_section_id = ta.class_section_id and e.is_active = true)
          or (public.current_user_role() = 'hod' and exists (
            select 1 from public.class_sections cs join public.programs p on p.id = cs.program_id
            where cs.id = ta.class_section_id and p.department_id = public.current_user_dept()
          ))
        )
    )
  )
);

drop policy if exists "syllabus_write" on public.syllabus_topics;
create policy "syllabus_write" on public.syllabus_topics
for all to authenticated using (
  public.is_approved_user()
  and (
    public.current_user_role() = 'admin'
    or exists (
      select 1 from public.teaching_assignments ta
      where ta.id = syllabus_topics.teaching_assignment_id and ta.faculty_id = auth.uid()
    )
  )
) with check (
  public.is_approved_user()
  and (
    public.current_user_role() = 'admin'
    or exists (
      select 1 from public.teaching_assignments ta
      where ta.id = syllabus_topics.teaching_assignment_id and ta.faculty_id = auth.uid()
    )
  )
);
