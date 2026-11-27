-- Migration 010: Data Integrity Constraints, Indexes, Attendance View & Scoped Calendar RLS
-- Idempotent incremental migration preserving all existing tables and data.

-- 1. Check constraints (added safely if not already present)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_academic_years_dates') then
    alter table public.academic_years add constraint chk_academic_years_dates check (end_date >= start_date);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_weekly_slots_times') then
    alter table public.weekly_schedule_slots add constraint chk_weekly_slots_times check (end_time > start_time);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_calendar_events_dates') then
    alter table public.calendar_events add constraint chk_calendar_events_dates check (end_at >= start_at);
  end if;
end $$;

-- 2. Submission version duplicate-file guard & performance indexes
create unique index if not exists idx_sub_ver_unique_file
  on public.submission_versions (submission_id, drive_file_id)
  where drive_file_id is not null and drive_file_id <> '';

create index if not exists idx_enrollments_student on public.enrollments (student_id);
create index if not exists idx_enrollments_section on public.enrollments (class_section_id);
create index if not exists idx_teaching_assignments_faculty on public.teaching_assignments (faculty_id);
create index if not exists idx_teaching_assignments_section on public.teaching_assignments (class_section_id);
create index if not exists idx_attendance_records_student on public.attendance_records (student_id);
create index if not exists idx_submissions_student on public.submissions (student_id);
create index if not exists idx_assignments_ta on public.assignments (teaching_assignment_id);
create index if not exists idx_calendar_events_start on public.calendar_events (start_at, department_id, class_section_id);

-- 3. Attendance correction audit columns & duplicate-pending guard
alter table public.attendance_correction_requests
  add column if not exists previous_status public.attendance_status,
  add column if not exists reviewed_at timestamptz;

create unique index if not exists idx_pending_correction_unique
  on public.attendance_correction_requests (session_id, student_id)
  where status = 'pending';

-- Allow students to also raise correction requests for their own attendance sessions
drop policy if exists "corrections_insert_faculty" on public.attendance_correction_requests;
create policy "corrections_insert_faculty_or_student" on public.attendance_correction_requests
for insert to authenticated with check (
  requested_by = auth.uid()
  and (
    (public.current_user_role() = 'student' and student_id = auth.uid() and exists (
      select 1 from public.attendance_sessions s
      join public.teaching_assignments ta on ta.id = s.teaching_assignment_id
      join public.enrollments e on e.class_section_id = ta.class_section_id
      where s.id = attendance_correction_requests.session_id and e.student_id = auth.uid() and e.is_active
    ))
    or (public.current_user_role() = 'faculty' and exists (
      select 1 from public.attendance_sessions s
      join public.teaching_assignments ta on ta.id = s.teaching_assignment_id
      where s.id = attendance_correction_requests.session_id and ta.faculty_id = auth.uid()
    ))
    or public.current_user_role() = 'admin'
  )
);

-- Update review_attendance_correction to record previous_status and reviewed_at
create or replace function public.review_attendance_correction(
  p_request_id uuid,
  p_decision text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_dept uuid;
  v_req record;
  v_prev public.attendance_status;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_decision not in ('approved', 'rejected') then raise exception 'Invalid decision'; end if;

  select role, department_id into v_role, v_dept from public.profiles where id = v_uid and status = 'approved';
  if v_role not in ('admin', 'hod') then
    raise exception 'Only Admin or HOD can review attendance corrections';
  end if;

  select r.*, p.department_id as sess_dept
  into v_req
  from public.attendance_correction_requests r
  join public.attendance_sessions s on s.id = r.session_id
  join public.teaching_assignments ta on ta.id = s.teaching_assignment_id
  join public.class_sections cs on cs.id = ta.class_section_id
  join public.programs p on p.id = cs.program_id
  where r.id = p_request_id
  for update of r;

  if not found then raise exception 'Correction request not found'; end if;
  if v_req.status <> 'pending' then raise exception 'Correction request has already been reviewed'; end if;
  if v_role = 'hod' and v_req.sess_dept <> v_dept then
    raise exception 'HOD can only review attendance corrections in their own department';
  end if;

  select status into v_prev
  from public.attendance_records
  where session_id = v_req.session_id and student_id = v_req.student_id;

  update public.attendance_correction_requests
  set status = p_decision,
      previous_status = coalesce(previous_status, v_prev),
      reviewed_by = v_uid,
      reviewed_at = now()
  where id = p_request_id;

  if p_decision = 'approved' then
    insert into public.attendance_records (session_id, student_id, status)
    values (v_req.session_id, v_req.student_id, v_req.requested_status)
    on conflict (session_id, student_id) do update set status = excluded.status;
  end if;

  insert into public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by, reason)
  values (
    'attendance_correction_requests',
    p_request_id,
    'REVIEW_ATTENDANCE_CORRECTION',
    jsonb_build_object('previous_status', v_prev),
    jsonb_build_object('decision', p_decision, 'new_status', v_req.requested_status),
    v_uid,
    v_req.reason
  );
end;
$$;

-- 4. ERP Settings RLS
drop policy if exists "erp_settings_read" on public.erp_settings;
drop policy if exists "erp_settings_admin_write" on public.erp_settings;
create policy "erp_settings_read" on public.erp_settings for select to authenticated using (public.is_approved_user());
create policy "erp_settings_admin_write" on public.erp_settings for update to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

-- 5. Scoped Calendar RLS (college-wide, department-scoped, class-scoped, HOD dept write)
drop policy if exists "calendar_read_approved" on public.calendar_events;
create policy "calendar_read_approved" on public.calendar_events
for select to authenticated using (
  public.is_approved_user()
  and (
    public.current_user_role() = 'admin'
    or created_by = auth.uid()
    or (department_id is null and class_section_id is null)
    or (department_id is not null and department_id = public.current_user_dept())
    or (class_section_id is not null and (
      exists (select 1 from public.enrollments e where e.class_section_id = calendar_events.class_section_id and e.student_id = auth.uid() and e.is_active)
      or exists (select 1 from public.teaching_assignments ta where ta.class_section_id = calendar_events.class_section_id and ta.faculty_id = auth.uid())
    ))
  )
);

drop policy if exists "calendar_hod_dept_insert" on public.calendar_events;
create policy "calendar_hod_dept_insert" on public.calendar_events
for insert to authenticated with check (
  public.current_user_role() = 'hod'
  and event_type = 'department_event'
  and department_id = public.current_user_dept()
  and created_by = auth.uid()
);

drop policy if exists "calendar_hod_dept_delete" on public.calendar_events;
create policy "calendar_hod_dept_delete" on public.calendar_events
for delete to authenticated using (
  public.current_user_role() = 'hod'
  and event_type = 'department_event'
  and created_by = auth.uid()
);

-- 6. Authoritative Student Attendance Summary View (respects conducted sessions & late_counts_as_present)
create or replace view public.v_student_attendance_summary
with (security_invoker = true) as
select
  ar.student_id,
  ta.id as teaching_assignment_id,
  sub.id as subject_id,
  sub.code as subject_code,
  sub.name as subject_name,
  cs.id as class_section_id,
  count(*) filter (where s.status = 'conducted') as conducted_sessions,
  count(*) filter (where s.status = 'cancelled') as cancelled_sessions,
  count(*) filter (where s.status = 'conducted' and ar.status = 'present') as present_count,
  count(*) filter (where s.status = 'conducted' and ar.status = 'late') as late_count,
  count(*) filter (where s.status = 'conducted' and ar.status = 'absent') as absent_count,
  case
    when count(*) filter (where s.status = 'conducted') = 0 then 0::numeric
    else round(
      (
        (count(*) filter (where s.status = 'conducted' and ar.status = 'present')
         + case when es.late_counts_as_present then count(*) filter (where s.status = 'conducted' and ar.status = 'late') else 0 end
        )::numeric
        / (count(*) filter (where s.status = 'conducted'))::numeric
      ) * 100.0,
      1
    )
  end as attendance_pct
from public.attendance_records ar
join public.attendance_sessions s on s.id = ar.session_id
join public.teaching_assignments ta on ta.id = s.teaching_assignment_id
join public.subjects sub on sub.id = ta.subject_id
join public.class_sections cs on cs.id = ta.class_section_id
cross join public.erp_settings es
where es.id = 1
group by ar.student_id, ta.id, sub.id, sub.code, sub.name, cs.id, es.late_counts_as_present;
