-- Migration 009: Security Audit Fixes, Department Isolation, Atomic RPCs & Audit Triggers
-- Incremental migration: preserves all existing tables and data from 001-008.

-- 1. Harden SECURITY DEFINER helper functions with explicit search_path and restricted EXECUTE
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and status = 'approved';
$$;

create or replace function public.current_user_dept()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select department_id from public.profiles where id = auth.uid() and status = 'approved';
$$;

create or replace function public.is_approved_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and status = 'approved');
$$;

create or replace function public.check_marks_within_max()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_max numeric(6,2);
begin
  if new.marks_obtained is not null then
    select a.max_marks into v_max
    from public.submissions s
    join public.assignments a on a.id = s.assignment_id
    where s.id = new.submission_id;

    if new.marks_obtained < 0 or new.marks_obtained > v_max then
      raise exception 'marks_obtained (%) must be between 0 and assignment max_marks (%)', new.marks_obtained, v_max;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.current_user_role() from public;
revoke all on function public.current_user_dept() from public;
revoke all on function public.is_approved_user() from public;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.current_user_dept() to authenticated;
grant execute on function public.is_approved_user() to authenticated;

-- 2. Profile security: strict self-only or Admin/same-dept HOD select; Admin-only update
drop policy if exists "profiles_select_self_or_admin_hod" on public.profiles;
create policy "profiles_select_self_or_admin_hod" on public.profiles
for select to authenticated using (
  id = auth.uid()
  or public.current_user_role() = 'admin'
  or (public.current_user_role() = 'hod' and department_id = public.current_user_dept())
  or (
    public.current_user_role() = 'faculty'
    and role = 'student'
    and status = 'approved'
    and exists (
      select 1 from public.enrollments e
      join public.teaching_assignments ta on ta.class_section_id = e.class_section_id
      where e.student_id = profiles.id and ta.faculty_id = auth.uid() and e.is_active
    )
  )
);

drop policy if exists "profiles_update_admin_only" on public.profiles;
create policy "profiles_update_admin_only" on public.profiles
for update to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

-- 3. Weekly Schedule Slots RLS
drop policy if exists "slots_read_approved" on public.weekly_schedule_slots;
drop policy if exists "slots_admin_write" on public.weekly_schedule_slots;

create policy "slots_read_approved" on public.weekly_schedule_slots
for select to authenticated using (public.is_approved_user());

create policy "slots_admin_write" on public.weekly_schedule_slots
for all to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

-- 4. HOD Department Isolation for Attendance, Assignments, Submissions, Evaluations & Corrections
drop policy if exists "att_sessions_select" on public.attendance_sessions;
create policy "att_sessions_select" on public.attendance_sessions
for select to authenticated using (
  public.current_user_role() = 'admin'
  or exists (select 1 from public.teaching_assignments ta where ta.id = attendance_sessions.teaching_assignment_id and ta.faculty_id = auth.uid())
  or exists (
    select 1 from public.teaching_assignments ta
    join public.enrollments e on e.class_section_id = ta.class_section_id
    where ta.id = attendance_sessions.teaching_assignment_id and e.student_id = auth.uid() and e.is_active
  )
  or (public.current_user_role() = 'hod' and exists (
    select 1 from public.teaching_assignments ta
    join public.class_sections cs on cs.id = ta.class_section_id
    join public.programs p on p.id = cs.program_id
    where ta.id = attendance_sessions.teaching_assignment_id and p.department_id = public.current_user_dept()
  ))
);

drop policy if exists "att_records_select" on public.attendance_records;
create policy "att_records_select" on public.attendance_records
for select to authenticated using (
  student_id = auth.uid()
  or public.current_user_role() = 'admin'
  or exists (
    select 1 from public.attendance_sessions s
    join public.teaching_assignments ta on ta.id = s.teaching_assignment_id
    where s.id = attendance_records.session_id and ta.faculty_id = auth.uid()
  )
  or (public.current_user_role() = 'hod' and exists (
    select 1 from public.attendance_sessions s
    join public.teaching_assignments ta on ta.id = s.teaching_assignment_id
    join public.class_sections cs on cs.id = ta.class_section_id
    join public.programs p on p.id = cs.program_id
    where s.id = attendance_records.session_id and p.department_id = public.current_user_dept()
  ))
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
      and s.created_at > now() - interval '24 hours'
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
      and s.created_at > now() - interval '24 hours'
  )
);

drop policy if exists "assignments_select" on public.assignments;
create policy "assignments_select" on public.assignments
for select to authenticated using (
  public.current_user_role() = 'admin'
  or exists (select 1 from public.teaching_assignments ta where ta.id = assignments.teaching_assignment_id and ta.faculty_id = auth.uid())
  or (public.current_user_role() = 'hod' and exists (
    select 1 from public.teaching_assignments ta
    join public.class_sections cs on cs.id = ta.class_section_id
    join public.programs p on p.id = cs.program_id
    where ta.id = assignments.teaching_assignment_id and p.department_id = public.current_user_dept()
  ))
  or (
    state in ('published', 'closed')
    and exists (
      select 1 from public.teaching_assignments ta
      join public.enrollments e on e.class_section_id = ta.class_section_id
      where ta.id = assignments.teaching_assignment_id and e.student_id = auth.uid() and e.is_active
    )
  )
);

drop policy if exists "submissions_select" on public.submissions;
create policy "submissions_select" on public.submissions
for select to authenticated using (
  student_id = auth.uid()
  or public.current_user_role() = 'admin'
  or exists (
    select 1 from public.assignments a
    join public.teaching_assignments ta on ta.id = a.teaching_assignment_id
    where a.id = submissions.assignment_id and ta.faculty_id = auth.uid()
  )
  or (public.current_user_role() = 'hod' and exists (
    select 1 from public.assignments a
    join public.teaching_assignments ta on ta.id = a.teaching_assignment_id
    join public.class_sections cs on cs.id = ta.class_section_id
    join public.programs p on p.id = cs.program_id
    where a.id = submissions.assignment_id and p.department_id = public.current_user_dept()
  ))
);

drop policy if exists "submission_versions_select" on public.submission_versions;
create policy "submission_versions_select" on public.submission_versions
for select to authenticated using (
  public.current_user_role() = 'admin'
  or exists (
    select 1 from public.submissions s where s.id = submission_versions.submission_id and s.student_id = auth.uid()
  )
  or exists (
    select 1 from public.submissions s
    join public.assignments a on a.id = s.assignment_id
    join public.teaching_assignments ta on ta.id = a.teaching_assignment_id
    where s.id = submission_versions.submission_id and ta.faculty_id = auth.uid()
  )
  or (public.current_user_role() = 'hod' and exists (
    select 1 from public.submissions s
    join public.assignments a on a.id = s.assignment_id
    join public.teaching_assignments ta on ta.id = a.teaching_assignment_id
    join public.class_sections cs on cs.id = ta.class_section_id
    join public.programs p on p.id = cs.program_id
    where s.id = submission_versions.submission_id and p.department_id = public.current_user_dept()
  ))
);

drop policy if exists "evaluations_select" on public.evaluations;
create policy "evaluations_select" on public.evaluations
for select to authenticated using (
  public.current_user_role() = 'admin'
  or exists (
    select 1 from public.submissions s
    join public.assignments a on a.id = s.assignment_id
    join public.teaching_assignments ta on ta.id = a.teaching_assignment_id
    where s.id = evaluations.submission_id and ta.faculty_id = auth.uid()
  )
  or (public.current_user_role() = 'hod' and exists (
    select 1 from public.submissions s
    join public.assignments a on a.id = s.assignment_id
    join public.teaching_assignments ta on ta.id = a.teaching_assignment_id
    join public.class_sections cs on cs.id = ta.class_section_id
    join public.programs p on p.id = cs.program_id
    where s.id = evaluations.submission_id and p.department_id = public.current_user_dept()
  ))
  or (
    published_at is not null
    and status = 'published'
    and exists (select 1 from public.submissions s where s.id = evaluations.submission_id and s.student_id = auth.uid())
  )
);

drop policy if exists "corrections_read" on public.attendance_correction_requests;
create policy "corrections_read" on public.attendance_correction_requests
for select to authenticated using (
  requested_by = auth.uid()
  or public.current_user_role() = 'admin'
  or (public.current_user_role() = 'hod' and exists (
    select 1 from public.attendance_sessions s
    join public.teaching_assignments ta on ta.id = s.teaching_assignment_id
    join public.class_sections cs on cs.id = ta.class_section_id
    join public.programs p on p.id = cs.program_id
    where s.id = attendance_correction_requests.session_id and p.department_id = public.current_user_dept()
  ))
);

drop policy if exists "corrections_review_admin_hod" on public.attendance_correction_requests;
create policy "corrections_review_admin_hod" on public.attendance_correction_requests
for update to authenticated using (
  public.current_user_role() = 'admin'
  or (public.current_user_role() = 'hod' and exists (
    select 1 from public.attendance_sessions s
    join public.teaching_assignments ta on ta.id = s.teaching_assignment_id
    join public.class_sections cs on cs.id = ta.class_section_id
    join public.programs p on p.id = cs.program_id
    where s.id = attendance_correction_requests.session_id and p.department_id = public.current_user_dept()
  ))
);

-- 5. Transactional RPC Functions
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
  v_next_ver int;
  v_is_late boolean;
  v_ver_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

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

  if not found then
    raise exception 'Assignment not found';
  end if;

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

  if v_is_late and not v_asg.allow_resubmission and not coalesce(v_sub.resubmission_allowed_after_due, false) then
    raise exception 'Submission deadline has passed';
  end if;

  if found and not v_asg.allow_resubmission and v_sub.status <> 'resubmission_requested' then
    raise exception 'Resubmission is not enabled for this assignment';
  end if;

  if not found then
    insert into public.submissions (assignment_id, student_id, status)
    values (p_assignment_id, v_uid, case when v_is_late then 'late'::public.submission_status else 'submitted'::public.submission_status end)
    returning * into v_sub;
  else
    update public.submissions
    set status = case when v_is_late then 'late'::public.submission_status else 'submitted'::public.submission_status end,
        updated_at = now()
    where id = v_sub.id;
  end if;

  select coalesce(max(version_no), 0) + 1 into v_next_ver
  from public.submission_versions
  where submission_id = v_sub.id;

  insert into public.submission_versions (submission_id, version_no, drive_url, drive_file_id, is_late)
  values (v_sub.id, v_next_ver, trim(p_drive_url), trim(p_drive_file_id), v_is_late)
  returning id into v_ver_id;

  insert into public.audit_logs (table_name, record_id, action, new_data, changed_by, reason)
  values ('submission_versions', v_ver_id, 'SUBMIT_ASSIGNMENT', jsonb_build_object('assignment_id', p_assignment_id, 'version_no', v_next_ver, 'is_late', v_is_late), v_uid, 'Student submitted Google Drive link');

  return jsonb_build_object('submission_id', v_sub.id, 'version_id', v_ver_id, 'version_no', v_next_ver, 'is_late', v_is_late);
end;
$$;

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

  select a.max_marks, ta.faculty_id into v_max, v_faculty
  from public.submissions s
  join public.assignments a on a.id = s.assignment_id
  join public.teaching_assignments ta on ta.id = a.teaching_assignment_id
  where s.id = p_submission_id;

  if not found then raise exception 'Submission not found'; end if;
  if v_role <> 'admin' and v_faculty <> v_uid then
    raise exception 'Only assigned faculty or admin can evaluate this submission';
  end if;

  if not exists (select 1 from public.submission_versions sv where sv.id = p_graded_version_id and sv.submission_id = p_submission_id) then
    raise exception 'Invalid submission version';
  end if;

  if p_marks_obtained < 0 or p_marks_obtained > v_max then
    raise exception 'Marks must be between 0 and %', v_max;
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
  values ('evaluations', v_eval_id, 'SAVE_EVALUATION_DRAFT', jsonb_build_object('submission_id', p_submission_id, 'marks', p_marks_obtained), v_uid, 'Saved evaluation draft');

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
  v_eval_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select role into v_role from public.profiles where id = v_uid and status = 'approved';

  select a.max_marks, ta.faculty_id into v_max, v_faculty
  from public.submissions s
  join public.assignments a on a.id = s.assignment_id
  join public.teaching_assignments ta on ta.id = a.teaching_assignment_id
  where s.id = p_submission_id;

  if not found then raise exception 'Submission not found'; end if;
  if v_role <> 'admin' and v_faculty <> v_uid then
    raise exception 'Only assigned faculty or admin can publish marks';
  end if;

  if not exists (select 1 from public.submission_versions sv where sv.id = p_graded_version_id and sv.submission_id = p_submission_id) then
    raise exception 'Invalid submission version';
  end if;

  if p_marks_obtained < 0 or p_marks_obtained > v_max then
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

  insert into public.audit_logs (table_name, record_id, action, new_data, changed_by, reason)
  values ('evaluations', v_eval_id, 'PUBLISH_MARKS', jsonb_build_object('submission_id', p_submission_id, 'marks', p_marks_obtained), v_uid, 'Published marks to student');

  return v_eval_id;
end;
$$;

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
  v_sess_dept uuid;
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
  where r.id = p_request_id;

  if not found then raise exception 'Correction request not found'; end if;
  if v_role = 'hod' and v_req.sess_dept <> v_dept then
    raise exception 'HOD can only review attendance corrections in their own department';
  end if;

  update public.attendance_correction_requests
  set status = p_decision, reviewed_by = v_uid
  where id = p_request_id;

  if p_decision = 'approved' then
    insert into public.attendance_records (session_id, student_id, status)
    values (v_req.session_id, v_req.student_id, v_req.requested_status)
    on conflict (session_id, student_id) do update set status = excluded.status;
  end if;

  insert into public.audit_logs (table_name, record_id, action, new_data, changed_by, reason)
  values ('attendance_correction_requests', p_request_id, 'REVIEW_ATTENDANCE_CORRECTION', jsonb_build_object('decision', p_decision), v_uid, v_req.reason);
end;
$$;

revoke all on function public.submit_assignment(uuid, text, text) from public;
revoke all on function public.save_evaluation(uuid, uuid, numeric, text) from public;
revoke all on function public.publish_evaluation(uuid, uuid, numeric, text) from public;
revoke all on function public.review_attendance_correction(uuid, text) from public;

grant execute on function public.submit_assignment(uuid, text, text) to authenticated;
grant execute on function public.save_evaluation(uuid, uuid, numeric, text) to authenticated;
grant execute on function public.publish_evaluation(uuid, uuid, numeric, text) to authenticated;
grant execute on function public.review_attendance_correction(uuid, text) to authenticated;

-- 6. Audit Triggers for Profile Role/Status Changes & Assignment Publication
create or replace function public.audit_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role or new.status is distinct from old.status then
    insert into public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by, reason)
    values (
      'profiles',
      new.id,
      'PROFILE_ROLE_OR_STATUS_CHANGE',
      jsonb_build_object('role', old.role, 'status', old.status),
      jsonb_build_object('role', new.role, 'status', new.status),
      coalesce(auth.uid(), new.id),
      'Account role/status updated'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_profile_changes on public.profiles;
create trigger trg_audit_profile_changes
after update on public.profiles
for each row execute function public.audit_profile_changes();

create or replace function public.audit_assignment_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.state is distinct from old.state then
    insert into public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by, reason)
    values (
      'assignments',
      new.id,
      case when tg_op = 'INSERT' then 'CREATE_ASSIGNMENT' else 'UPDATE_ASSIGNMENT_STATE' end,
      case when tg_op = 'INSERT' then null else jsonb_build_object('state', old.state) end,
      jsonb_build_object('title', new.title, 'state', new.state),
      coalesce(auth.uid(), new.created_by),
      'Assignment lifecycle update'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_assignment_changes on public.assignments;
create trigger trg_audit_assignment_changes
after insert or update on public.assignments
for each row execute function public.audit_assignment_changes();
