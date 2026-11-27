-- College ERP — Row Level Security (RLS) Policies
-- Enforces role + academic scope (department, teaching assignment, enrollment, self) in PostgreSQL.

-- Helper functions
create or replace function current_user_role() returns user_role as $$
  select role from profiles where id = auth.uid() and status = 'approved';
$$ language sql stable security definer;

create or replace function current_user_dept() returns uuid as $$
  select department_id from profiles where id = auth.uid() and status = 'approved';
$$ language sql stable security definer;

create or replace function is_approved_user() returns boolean as $$
  select exists(select 1 from profiles where id = auth.uid() and status = 'approved');
$$ language sql stable security definer;

-- Enable RLS on all core tables
alter table erp_settings enable row level security;
alter table departments enable row level security;
alter table programs enable row level security;
alter table academic_years enable row level security;
alter table semesters enable row level security;
alter table class_sections enable row level security;
alter table subjects enable row level security;
alter table profiles enable row level security;
alter table student_profiles enable row level security;
alter table faculty_profiles enable row level security;
alter table teaching_assignments enable row level security;
alter table enrollments enable row level security;
alter table weekly_schedule_slots enable row level security;
alter table attendance_sessions enable row level security;
alter table attendance_records enable row level security;
alter table drive_files enable row level security;
alter table assignments enable row level security;
alter table submissions enable row level security;
alter table submission_versions enable row level security;
alter table evaluations enable row level security;
alter table calendar_events enable row level security;
alter table notifications enable row level security;
alter table audit_logs enable row level security;
alter table backup_sync_logs enable row level security;

-- Revoke broad anon privileges
revoke all on all tables in schema public from anon;

-- Profiles: users can view their own profile (even if pending, to see status); admin sees all; HOD sees dept
create policy "profiles_select_self_or_admin_hod" on profiles
for select to authenticated using (
  id = auth.uid()
  or current_user_role() = 'admin'
  or (current_user_role() = 'hod' and department_id = current_user_dept())
);

create policy "profiles_update_admin_only" on profiles
for update to authenticated using (current_user_role() = 'admin');

-- Academic catalog: readable by any approved user; writable only by admin
create policy "catalog_read_approved" on departments for select to authenticated using (is_approved_user());
create policy "catalog_write_admin" on departments for all to authenticated using (current_user_role() = 'admin');

create policy "programs_read" on programs for select to authenticated using (is_approved_user());
create policy "programs_admin" on programs for all to authenticated using (current_user_role() = 'admin');

create policy "years_read" on academic_years for select to authenticated using (is_approved_user());
create policy "years_admin" on academic_years for all to authenticated using (current_user_role() = 'admin');

create policy "semesters_read" on semesters for select to authenticated using (is_approved_user());
create policy "semesters_admin" on semesters for all to authenticated using (current_user_role() = 'admin');

create policy "classes_read" on class_sections for select to authenticated using (is_approved_user());
create policy "classes_admin" on class_sections for all to authenticated using (current_user_role() = 'admin');

create policy "subjects_read" on subjects for select to authenticated using (is_approved_user());
create policy "subjects_admin" on subjects for all to authenticated using (current_user_role() = 'admin');

-- Teaching assignments & enrollments
create policy "ta_read" on teaching_assignments for select to authenticated using (
  current_user_role() = 'admin'
  or faculty_id = auth.uid()
  or exists (select 1 from enrollments e where e.student_id = auth.uid() and e.class_section_id = teaching_assignments.class_section_id)
  or (current_user_role() = 'hod' and exists (
    select 1 from class_sections cs join programs p on p.id = cs.program_id
    where cs.id = teaching_assignments.class_section_id and p.department_id = current_user_dept()
  ))
);
create policy "ta_admin" on teaching_assignments for all to authenticated using (current_user_role() = 'admin');

create policy "enrollments_read" on enrollments for select to authenticated using (
  student_id = auth.uid()
  or current_user_role() = 'admin'
  or exists (select 1 from teaching_assignments ta where ta.class_section_id = enrollments.class_section_id and ta.faculty_id = auth.uid())
  or (current_user_role() = 'hod' and exists (
    select 1 from class_sections cs join programs p on p.id = cs.program_id
    where cs.id = enrollments.class_section_id and p.department_id = current_user_dept()
  ))
);
create policy "enrollments_admin" on enrollments for all to authenticated using (current_user_role() = 'admin');

-- Attendance sessions & records
create policy "att_sessions_select" on attendance_sessions for select to authenticated using (
  current_user_role() = 'admin'
  or exists (select 1 from teaching_assignments ta where ta.id = attendance_sessions.teaching_assignment_id and ta.faculty_id = auth.uid())
  or exists (
    select 1 from teaching_assignments ta join enrollments e on e.class_section_id = ta.class_section_id
    where ta.id = attendance_sessions.teaching_assignment_id and e.student_id = auth.uid()
  )
  or (current_user_role() = 'hod' and exists (
    select 1 from teaching_assignments ta
    join class_sections cs on cs.id = ta.class_section_id
    join programs p on p.id = cs.program_id
    where ta.id = attendance_sessions.teaching_assignment_id and p.department_id = current_user_dept()
  ))
);

create policy "att_sessions_insert_faculty" on attendance_sessions for insert to authenticated with check (
  current_user_role() = 'admin'
  or exists (select 1 from teaching_assignments ta where ta.id = attendance_sessions.teaching_assignment_id and ta.faculty_id = auth.uid())
);

-- Faculty can only update within 24h; Admin/HOD can correct anytime
create policy "att_sessions_update" on attendance_sessions for update to authenticated using (
  current_user_role() = 'admin'
  or current_user_role() = 'hod'
  or (
    exists (select 1 from teaching_assignments ta where ta.id = attendance_sessions.teaching_assignment_id and ta.faculty_id = auth.uid())
    and created_at > now() - interval '24 hours'
  )
);

create policy "att_records_select" on attendance_records for select to authenticated using (
  student_id = auth.uid()
  or current_user_role() in ('admin', 'hod')
  or exists (
    select 1 from attendance_sessions s join teaching_assignments ta on ta.id = s.teaching_assignment_id
    where s.id = attendance_records.session_id and ta.faculty_id = auth.uid()
  )
);

-- Assignments: students only see published/closed for their enrolled class
create policy "assignments_select" on assignments for select to authenticated using (
  current_user_role() in ('admin', 'hod')
  or exists (select 1 from teaching_assignments ta where ta.id = assignments.teaching_assignment_id and ta.faculty_id = auth.uid())
  or (
    state in ('published', 'closed')
    and exists (
      select 1 from teaching_assignments ta join enrollments e on e.class_section_id = ta.class_section_id
      where ta.id = assignments.teaching_assignment_id and e.student_id = auth.uid()
    )
  )
);

create policy "assignments_faculty_write" on assignments for all to authenticated using (
  current_user_role() = 'admin'
  or exists (select 1 from teaching_assignments ta where ta.id = assignments.teaching_assignment_id and ta.faculty_id = auth.uid())
);

-- Submissions & Versions: strictly student self + assigned faculty
create policy "submissions_select" on submissions for select to authenticated using (
  student_id = auth.uid()
  or current_user_role() in ('admin', 'hod')
  or exists (
    select 1 from assignments a join teaching_assignments ta on ta.id = a.teaching_assignment_id
    where a.id = submissions.assignment_id and ta.faculty_id = auth.uid()
  )
);

create policy "submissions_student_write" on submissions for insert to authenticated with check (
  student_id = auth.uid()
);

-- Evaluations: students ONLY see rows where published_at is not null
create policy "evaluations_select" on evaluations for select to authenticated using (
  current_user_role() in ('admin', 'hod')
  or exists (
    select 1 from submissions s join assignments a on a.id = s.assignment_id
    join teaching_assignments ta on ta.id = a.teaching_assignment_id
    where s.id = evaluations.submission_id and ta.faculty_id = auth.uid()
  )
  or (
    published_at is not null
    and exists (select 1 from submissions s where s.id = evaluations.submission_id and s.student_id = auth.uid())
  )
);

-- Notifications: strict self-only
create policy "notifications_self" on notifications for all to authenticated using (user_id = auth.uid());

-- Audit logs: readable by Admin & HOD; insertable by authenticated triggers/RPCs
create policy "audit_read" on audit_logs for select to authenticated using (current_user_role() in ('admin', 'hod'));
