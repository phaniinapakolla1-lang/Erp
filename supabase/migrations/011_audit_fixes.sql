-- Migration 011: audit fixes (security, deadline logic, attendance integrity, scoping)
-- Run after 010. Safe to re-run (drop-if-exists / create-or-replace throughout).

-- ---------------------------------------------------------------------------
-- 0. Schema additions
-- ---------------------------------------------------------------------------
-- Late submissions are now an explicit per-assignment choice (default: strict deadline).
alter table public.assignments
  add column if not exists allow_late_submission boolean not null default false;

-- Deleting a submission chain must not be blocked by the evaluation -> version FK.
alter table public.evaluations drop constraint if exists evaluations_graded_version_id_fkey;
alter table public.evaluations
  add constraint evaluations_graded_version_id_fkey
  foreign key (graded_version_id) references public.submission_versions(id) on delete cascade;

-- ---------------------------------------------------------------------------
-- 1. Enforce account approval at the database layer
--    A RESTRICTIVE policy is ANDed with every permissive policy, so pending /
--    rejected / disabled users lose API access to everything except their own
--    profile row (profiles is intentionally excluded so the app can show status).
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'erp_settings','departments','programs','academic_years','semesters','class_sections','subjects',
    'student_profiles','faculty_profiles','teaching_assignments','enrollments','weekly_schedule_slots',
    'attendance_sessions','attendance_records','drive_files','assignments','submissions',
    'submission_versions','evaluations','calendar_events','notifications','audit_logs',
    'backup_sync_logs','onboarding_allowlist','attendance_correction_requests'
  ] loop
    continue when to_regclass('public.' || t) is null;  -- tables removed by 012 are skipped on re-run
    execute format('drop policy if exists "require_approved" on public.%I', t);
    execute format(
      'create policy "require_approved" on public.%I as restrictive for all to authenticated using (public.is_approved_user())',
      t);
  end loop;
end $$;

-- Future tables/views must not be readable by anon by default.
alter default privileges in schema public revoke all on tables from anon;
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------
-- 2. Submissions: no direct student inserts (RPC only), faculty cannot hard-delete assignments
-- ---------------------------------------------------------------------------
drop policy if exists "submissions_student_write" on public.submissions;

drop policy if exists "assignments_faculty_write" on public.assignments;
drop policy if exists "assignments_insert" on public.assignments;
drop policy if exists "assignments_update" on public.assignments;
drop policy if exists "assignments_delete_admin" on public.assignments;

create policy "assignments_insert" on public.assignments
for insert to authenticated with check (
  created_by = auth.uid()
  and (
    public.current_user_role() = 'admin'
    or exists (select 1 from public.teaching_assignments ta where ta.id = assignments.teaching_assignment_id and ta.faculty_id = auth.uid())
  )
);
create policy "assignments_update" on public.assignments
for update to authenticated
using (
  public.current_user_role() = 'admin'
  or exists (select 1 from public.teaching_assignments ta where ta.id = assignments.teaching_assignment_id and ta.faculty_id = auth.uid())
)
with check (
  public.current_user_role() = 'admin'
  or exists (select 1 from public.teaching_assignments ta where ta.id = assignments.teaching_assignment_id and ta.faculty_id = auth.uid())
);
create policy "assignments_delete_admin" on public.assignments
for delete to authenticated using (public.current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- 3. submit_assignment: real deadline + post-grading protection
-- ---------------------------------------------------------------------------
create or replace function public.submit_assignment(
  p_assignment_id uuid,
  p_drive_url text,
  p_drive_file_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_asg record;
  v_sub record;
  v_has_sub boolean;
  v_next_ver int;
  v_is_late boolean;
  v_ver_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select role into v_role from public.profiles where id = v_uid and status = 'approved';
  if v_role is distinct from 'student'::public.user_role then
    raise exception 'Only approved students can submit assignments';
  end if;

  if p_drive_url !~ '^https://(drive|docs)\.google\.com/' or p_drive_file_id !~ '^[a-zA-Z0-9_-]{10,}$' then
    raise exception 'Invalid Google Drive URL or File ID';
  end if;

  select a.*, ta.class_section_id
  into v_asg
  from public.assignments a
  join public.teaching_assignments ta on ta.id = a.teaching_assignment_id
  where a.id = p_assignment_id;
  if not found then raise exception 'Assignment not found'; end if;

  if v_asg.state <> 'published' then
    raise exception 'Assignment is not accepting submissions';
  end if;

  if not exists (
    select 1 from public.enrollments e
    where e.student_id = v_uid and e.class_section_id = v_asg.class_section_id and e.is_active
  ) then
    raise exception 'You are not enrolled in this class section';
  end if;

  v_is_late := now() > v_asg.due_at;

  select * into v_sub
  from public.submissions
  where assignment_id = p_assignment_id and student_id = v_uid
  for update;
  v_has_sub := found;   -- capture immediately; FOUND is overwritten by later statements

  -- Deadline: late only if the assignment allows it or faculty re-opened this submission.
  if v_is_late
     and not v_asg.allow_late_submission
     and not (v_has_sub and coalesce(v_sub.resubmission_allowed_after_due, false)) then
    raise exception 'Submission deadline has passed';
  end if;

  if v_has_sub and v_sub.status <> 'not_submitted' then
    if not v_asg.allow_resubmission and v_sub.status <> 'resubmission_requested' then
      raise exception 'Resubmission is not enabled for this assignment';
    end if;
    -- Once marks are published the work is locked unless faculty requested a resubmission.
    if v_sub.status <> 'resubmission_requested' and exists (
      select 1 from public.evaluations ev where ev.submission_id = v_sub.id and ev.status = 'published'
    ) then
      raise exception 'Marks are already published for this assignment. Ask your faculty to request a resubmission.';
    end if;
  end if;

  if not v_has_sub then
    insert into public.submissions (assignment_id, student_id, status)
    values (p_assignment_id, v_uid,
      case when v_is_late then 'late'::public.submission_status else 'submitted'::public.submission_status end)
    returning * into v_sub;
  else
    update public.submissions
    set status = case when v_is_late then 'late'::public.submission_status else 'submitted'::public.submission_status end,
        resubmission_allowed_after_due = false,
        updated_at = now()
    where id = v_sub.id;
  end if;

  select coalesce(max(version_no), 0) + 1 into v_next_ver
  from public.submission_versions where submission_id = v_sub.id;

  insert into public.submission_versions (submission_id, version_no, drive_url, drive_file_id, is_late)
  values (v_sub.id, v_next_ver, trim(p_drive_url), trim(p_drive_file_id), v_is_late)
  returning id into v_ver_id;

  insert into public.audit_logs (table_name, record_id, action, new_data, changed_by, reason)
  values ('submission_versions', v_ver_id, 'SUBMIT_ASSIGNMENT',
          jsonb_build_object('assignment_id', p_assignment_id, 'version_no', v_next_ver, 'is_late', v_is_late),
          v_uid, 'Student submitted Google Drive link');

  return jsonb_build_object('submission_id', v_sub.id, 'version_id', v_ver_id, 'version_no', v_next_ver, 'is_late', v_is_late);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Evaluation RPCs: NULL-role bypass fixed, NULL marks rejected, published marks not silently unpublished
-- ---------------------------------------------------------------------------
create or replace function public.save_evaluation(
  p_submission_id uuid,
  p_graded_version_id uuid,
  p_marks_obtained numeric,
  p_feedback text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_max numeric(6,2);
  v_faculty uuid;
  v_eval_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select role into v_role from public.profiles where id = v_uid and status = 'approved';
  if v_role is null then raise exception 'Account is not approved'; end if;

  select a.max_marks, ta.faculty_id into v_max, v_faculty
  from public.submissions s
  join public.assignments a on a.id = s.assignment_id
  join public.teaching_assignments ta on ta.id = a.teaching_assignment_id
  where s.id = p_submission_id;
  if not found then raise exception 'Submission not found'; end if;

  if v_role <> 'admin' and v_faculty is distinct from v_uid then
    raise exception 'Only assigned faculty or admin can evaluate this submission';
  end if;

  if not exists (select 1 from public.submission_versions sv where sv.id = p_graded_version_id and sv.submission_id = p_submission_id) then
    raise exception 'Invalid submission version';
  end if;

  if p_marks_obtained is null or p_marks_obtained < 0 or p_marks_obtained > v_max then
    raise exception 'Marks must be between 0 and %', v_max;
  end if;

  if exists (select 1 from public.evaluations where submission_id = p_submission_id and status = 'published') then
    raise exception 'Marks are already published. Use Publish to update them.';
  end if;

  insert into public.evaluations (submission_id, graded_version_id, marks_obtained, feedback, status, evaluated_by, evaluated_at, published_at)
  values (p_submission_id, p_graded_version_id, p_marks_obtained, coalesce(p_feedback, ''), 'draft', v_uid, now(), null)
  on conflict (submission_id) do update
  set graded_version_id = excluded.graded_version_id,
      marks_obtained = excluded.marks_obtained,
      feedback = excluded.feedback,
      status = 'draft',
      evaluated_by = v_uid,
      evaluated_at = now(),
      published_at = null
  returning id into v_eval_id;

  insert into public.audit_logs (table_name, record_id, action, new_data, changed_by, reason)
  values ('evaluations', v_eval_id, 'SAVE_EVALUATION_DRAFT',
          jsonb_build_object('submission_id', p_submission_id, 'marks', p_marks_obtained), v_uid, 'Saved evaluation draft');
  return v_eval_id;
end;
$$;

create or replace function public.publish_evaluation(
  p_submission_id uuid,
  p_graded_version_id uuid,
  p_marks_obtained numeric,
  p_feedback text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_max numeric(6,2);
  v_faculty uuid;
  v_student uuid;
  v_title text;
  v_eval_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select role into v_role from public.profiles where id = v_uid and status = 'approved';
  if v_role is null then raise exception 'Account is not approved'; end if;

  select a.max_marks, ta.faculty_id, s.student_id, a.title into v_max, v_faculty, v_student, v_title
  from public.submissions s
  join public.assignments a on a.id = s.assignment_id
  join public.teaching_assignments ta on ta.id = a.teaching_assignment_id
  where s.id = p_submission_id;
  if not found then raise exception 'Submission not found'; end if;

  if v_role <> 'admin' and v_faculty is distinct from v_uid then
    raise exception 'Only assigned faculty or admin can publish marks';
  end if;

  if not exists (select 1 from public.submission_versions sv where sv.id = p_graded_version_id and sv.submission_id = p_submission_id) then
    raise exception 'Invalid submission version';
  end if;

  if p_marks_obtained is null or p_marks_obtained < 0 or p_marks_obtained > v_max then
    raise exception 'Marks must be between 0 and %', v_max;
  end if;

  insert into public.evaluations (submission_id, graded_version_id, marks_obtained, feedback, status, evaluated_by, evaluated_at, published_at)
  values (p_submission_id, p_graded_version_id, p_marks_obtained, coalesce(p_feedback, ''), 'published', v_uid, now(), now())
  on conflict (submission_id) do update
  set graded_version_id = excluded.graded_version_id,
      marks_obtained = excluded.marks_obtained,
      feedback = excluded.feedback,
      status = 'published',
      evaluated_by = v_uid,
      evaluated_at = now(),
      published_at = now()
  returning id into v_eval_id;

  update public.submissions set status = 'evaluated', updated_at = now() where id = p_submission_id;

  insert into public.notifications (user_id, title, body, link_url)
  values (v_student, 'Marks published', 'Marks for "' || v_title || '" are now available.', '/student/marks');

  insert into public.audit_logs (table_name, record_id, action, new_data, changed_by, reason)
  values ('evaluations', v_eval_id, 'PUBLISH_MARKS',
          jsonb_build_object('submission_id', p_submission_id, 'marks', p_marks_obtained), v_uid, 'Published marks to student');
  return v_eval_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Request resubmission (previously a silent no-op: no UPDATE policy on submissions)
-- ---------------------------------------------------------------------------
create or replace function public.request_resubmission(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_faculty uuid;
  v_student uuid;
  v_title text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select role into v_role from public.profiles where id = v_uid and status = 'approved';
  if v_role is null then raise exception 'Account is not approved'; end if;

  select ta.faculty_id, s.student_id, a.title into v_faculty, v_student, v_title
  from public.submissions s
  join public.assignments a on a.id = s.assignment_id
  join public.teaching_assignments ta on ta.id = a.teaching_assignment_id
  where s.id = p_submission_id;
  if not found then raise exception 'Submission not found'; end if;

  if v_role <> 'admin' and v_faculty is distinct from v_uid then
    raise exception 'Only assigned faculty or admin can request a resubmission';
  end if;

  update public.submissions
  set status = 'resubmission_requested', resubmission_allowed_after_due = true, updated_at = now()
  where id = p_submission_id;

  insert into public.notifications (user_id, title, body, link_url)
  values (v_student, 'Resubmission requested', 'Please resubmit "' || v_title || '".', '/student/assignments');

  insert into public.audit_logs (table_name, record_id, action, new_data, changed_by, reason)
  values ('submissions', p_submission_id, 'REQUEST_RESUBMISSION', jsonb_build_object('status', 'resubmission_requested'), v_uid, 'Faculty requested resubmission');
end;
$$;

revoke all on function public.request_resubmission(uuid) from public;
grant execute on function public.request_resubmission(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Attendance correction review: NULL-role bypass fixed
-- ---------------------------------------------------------------------------
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
  if v_role is null or v_role not in ('admin', 'hod') then
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
  if v_role = 'hod' and v_req.sess_dept is distinct from v_dept then
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
    -- Only students actually enrolled in the session's class may be corrected.
    if not exists (
      select 1 from public.attendance_sessions s
      join public.teaching_assignments ta on ta.id = s.teaching_assignment_id
      join public.enrollments e on e.class_section_id = ta.class_section_id
      where s.id = v_req.session_id and e.student_id = v_req.student_id and e.is_active
    ) then
      raise exception 'Student is not enrolled in this session''s class';
    end if;
    insert into public.attendance_records (session_id, student_id, status)
    values (v_req.session_id, v_req.student_id, v_req.requested_status)
    on conflict (session_id, student_id) do update set status = excluded.status;
  end if;

  insert into public.notifications (user_id, title, body, link_url)
  values (v_req.student_id, 'Attendance correction ' || p_decision, 'Your attendance correction request was ' || p_decision || '.', '/student/attendance');

  insert into public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by, reason)
  values ('attendance_correction_requests', p_request_id, 'REVIEW_ATTENDANCE_CORRECTION',
          jsonb_build_object('previous_status', v_prev),
          jsonb_build_object('decision', p_decision, 'new_status', v_req.requested_status),
          v_uid, v_req.reason);
end;
$$;

-- Faculty-raised corrections must name a student of that session's class.
drop policy if exists "corrections_insert_faculty_or_student" on public.attendance_correction_requests;
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
      join public.enrollments e on e.class_section_id = ta.class_section_id
      where s.id = attendance_correction_requests.session_id
        and ta.faculty_id = auth.uid()
        and e.student_id = attendance_correction_requests.student_id and e.is_active
    ))
    or public.current_user_role() = 'admin'
  )
);

-- ---------------------------------------------------------------------------
-- 7. Attendance: configurable edit window, ownership, HOD scoping, audit trail
-- ---------------------------------------------------------------------------
create or replace function public.attendance_edit_window()
returns interval
language sql
stable
security definer
set search_path = public
as $$
  select make_interval(hours => coalesce((select attendance_edit_window_hours from public.erp_settings where id = 1), 24));
$$;
revoke all on function public.attendance_edit_window() from public;
grant execute on function public.attendance_edit_window() to authenticated;

drop policy if exists "att_sessions_insert_faculty" on public.attendance_sessions;
create policy "att_sessions_insert_faculty" on public.attendance_sessions
for insert to authenticated with check (
  recorded_by = auth.uid()
  and (
    public.current_user_role() = 'admin'
    or exists (select 1 from public.teaching_assignments ta where ta.id = attendance_sessions.teaching_assignment_id and ta.faculty_id = auth.uid())
  )
);

drop policy if exists "att_sessions_update" on public.attendance_sessions;
create policy "att_sessions_update" on public.attendance_sessions
for update to authenticated
using (
  public.current_user_role() = 'admin'
  or (public.current_user_role() = 'hod' and exists (
    select 1 from public.teaching_assignments ta
    join public.class_sections cs on cs.id = ta.class_section_id
    join public.programs p on p.id = cs.program_id
    where ta.id = attendance_sessions.teaching_assignment_id and p.department_id = public.current_user_dept()
  ))
  or (
    exists (select 1 from public.teaching_assignments ta where ta.id = attendance_sessions.teaching_assignment_id and ta.faculty_id = auth.uid())
    and created_at > now() - public.attendance_edit_window()
  )
)
with check (
  public.current_user_role() in ('admin', 'hod')
  or exists (select 1 from public.teaching_assignments ta where ta.id = attendance_sessions.teaching_assignment_id and ta.faculty_id = auth.uid())
);

drop policy if exists "att_records_faculty_write" on public.attendance_records;
create policy "att_records_faculty_write" on public.attendance_records
for all to authenticated
using (
  public.current_user_role() = 'admin'
  or exists (
    select 1 from public.attendance_sessions s
    join public.teaching_assignments ta on ta.id = s.teaching_assignment_id
    where s.id = attendance_records.session_id and ta.faculty_id = auth.uid()
      and s.created_at > now() - public.attendance_edit_window()
  )
)
with check (
  public.current_user_role() = 'admin'
  or exists (
    select 1 from public.attendance_sessions s
    join public.teaching_assignments ta on ta.id = s.teaching_assignment_id
    join public.enrollments e on e.class_section_id = ta.class_section_id
    where s.id = attendance_records.session_id
      and ta.faculty_id = auth.uid()
      and e.student_id = attendance_records.student_id
      and e.is_active
      and s.created_at > now() - public.attendance_edit_window()
  )
);

create or replace function public.audit_attendance_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_table_name = 'attendance_records' and new.status is distinct from old.status then
    insert into public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by, reason)
    values ('attendance_records', new.id, 'ATTENDANCE_STATUS_CHANGE',
            jsonb_build_object('status', old.status, 'student_id', old.student_id),
            jsonb_build_object('status', new.status, 'student_id', new.student_id),
            auth.uid(), 'Attendance status edited');
  elsif tg_table_name = 'attendance_sessions' and new.status is distinct from old.status then
    insert into public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by, reason)
    values ('attendance_sessions', new.id, 'ATTENDANCE_SESSION_STATUS_CHANGE',
            jsonb_build_object('status', old.status), jsonb_build_object('status', new.status),
            auth.uid(), 'Session status edited');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_attendance_records on public.attendance_records;
create trigger trg_audit_attendance_records
after update on public.attendance_records
for each row execute function public.audit_attendance_changes();

drop trigger if exists trg_audit_attendance_sessions on public.attendance_sessions;
create trigger trg_audit_attendance_sessions
after update on public.attendance_sessions
for each row execute function public.audit_attendance_changes();

-- ---------------------------------------------------------------------------
-- 8. Attendance summary view: driven by sessions + enrollments
--    (cancelled sessions are counted; conducted sessions with no record count as absent;
--     sessions before the student's enrollment date are ignored)
-- ---------------------------------------------------------------------------
create or replace view public.v_student_attendance_summary
with (security_invoker = true) as
select
  e.student_id,
  ta.id as teaching_assignment_id,
  sub.id as subject_id,
  sub.code as subject_code,
  sub.name as subject_name,
  cs.id as class_section_id,
  count(s.id) filter (where s.status = 'conducted') as conducted_sessions,
  count(s.id) filter (where s.status = 'cancelled') as cancelled_sessions,
  count(s.id) filter (where s.status = 'conducted' and ar.status = 'present') as present_count,
  count(s.id) filter (where s.status = 'conducted' and ar.status = 'late') as late_count,
  count(s.id) filter (where s.status = 'conducted' and (ar.status = 'absent' or ar.id is null)) as absent_count,
  case
    when count(s.id) filter (where s.status = 'conducted') = 0 then 0::numeric
    else round(
      (
        (count(s.id) filter (where s.status = 'conducted' and ar.status = 'present')
         + case when es.late_counts_as_present then count(s.id) filter (where s.status = 'conducted' and ar.status = 'late') else 0 end
        )::numeric
        / (count(s.id) filter (where s.status = 'conducted'))::numeric
      ) * 100.0, 1)
  end as attendance_pct
from public.enrollments e
join public.teaching_assignments ta on ta.class_section_id = e.class_section_id
join public.subjects sub on sub.id = ta.subject_id
join public.class_sections cs on cs.id = ta.class_section_id
join public.attendance_sessions s on s.teaching_assignment_id = ta.id and s.session_date >= e.enrolled_at::date
left join public.attendance_records ar on ar.session_id = s.id and ar.student_id = e.student_id
cross join public.erp_settings es
where es.id = 1 and e.is_active
group by e.student_id, ta.id, sub.id, sub.code, sub.name, cs.id, es.late_counts_as_present;

-- ---------------------------------------------------------------------------
-- 9. Visibility scoping: timetable slots, faculty names for students, class-scoped faculty notes
-- ---------------------------------------------------------------------------
drop policy if exists "slots_read_approved" on public.weekly_schedule_slots;
drop policy if exists "slots_read_scoped" on public.weekly_schedule_slots;
create policy "slots_read_scoped" on public.weekly_schedule_slots
for select to authenticated using (
  public.current_user_role() = 'admin'
  or exists (select 1 from public.teaching_assignments ta where ta.id = weekly_schedule_slots.teaching_assignment_id and ta.faculty_id = auth.uid())
  or exists (
    select 1 from public.teaching_assignments ta
    join public.enrollments e on e.class_section_id = ta.class_section_id
    where ta.id = weekly_schedule_slots.teaching_assignment_id and e.student_id = auth.uid() and e.is_active
  )
  or (public.current_user_role() = 'hod' and exists (
    select 1 from public.teaching_assignments ta
    join public.class_sections cs on cs.id = ta.class_section_id
    join public.programs p on p.id = cs.program_id
    where ta.id = weekly_schedule_slots.teaching_assignment_id and p.department_id = public.current_user_dept()
  ))
);

drop policy if exists "profiles_student_sees_own_faculty" on public.profiles;
create policy "profiles_student_sees_own_faculty" on public.profiles
for select to authenticated using (
  exists (
    select 1 from public.teaching_assignments ta
    join public.enrollments e on e.class_section_id = ta.class_section_id
    where ta.faculty_id = profiles.id and e.student_id = auth.uid() and e.is_active
  )
);

drop policy if exists "calendar_faculty_insert_own" on public.calendar_events;
create policy "calendar_faculty_insert_own" on public.calendar_events
for insert to authenticated with check (
  public.current_user_role() = 'faculty'
  and event_type = 'class_note'
  and created_by = auth.uid()
  and class_section_id is not null
  and exists (
    select 1 from public.teaching_assignments ta
    where ta.class_section_id = calendar_events.class_section_id and ta.faculty_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- 10. Maintain updated_at columns
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles','attendance_sessions','assignments','submissions','erp_settings'] loop
    execute format('drop trigger if exists trg_set_updated_at on public.%I', t);
    execute format('create trigger trg_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;
