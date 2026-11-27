-- Migration 021: Mail Directory Search & Privacy, Student Resubmission Requests, Extend Due Date, & Post-Submit Lock
-- Safe to re-run.

-- 1. Mail visibility preference on profiles ('public' or 'private')
alter table public.profiles
  add column if not exists mail_visibility text not null default 'public'
  check (mail_visibility in ('public', 'private'));

create or replace function public.set_mail_visibility(p_visibility text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_visibility not in ('public', 'private') then
    raise exception 'Visibility must be public or private';
  end if;
  update public.profiles
  set mail_visibility = p_visibility,
      updated_at = now()
  where id = auth.uid();
end;
$$;

-- Searchable Mail Directory RPC (Name, Email, or Roll No)
-- Admin, Faculty, and HOD can see all users (including private).
-- Students see public users + themselves.
create or replace function public.search_mail_directory(p_query text default '')
returns table (
  user_id uuid,
  full_name text,
  email text,
  role public.user_role,
  roll_no text,
  mail_visibility text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role public.user_role;
  v_q text := '%' || lower(btrim(coalesce(p_query, ''))) || '%';
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_approved_user() then raise exception 'Approved account required'; end if;

  select p.role into v_caller_role from public.profiles p where p.id = auth.uid();

  return query
  select
    p.id as user_id,
    p.full_name,
    p.email,
    p.role,
    sp.roll_no,
    p.mail_visibility
  from public.profiles p
  left join public.student_profiles sp on sp.user_id = p.id
  where p.status = 'approved'
    and (
      v_caller_role in ('admin', 'faculty', 'hod')
      or p.mail_visibility = 'public'
      or p.id = auth.uid()
    )
    and (
      btrim(coalesce(p_query, '')) = ''
      or lower(p.full_name) like v_q
      or lower(p.email) like v_q
      or lower(coalesce(sp.roll_no, '')) like v_q
    )
  order by p.full_name
  limit 100;
end;
$$;

-- 2. Student Resubmission Requests table
create table if not exists public.resubmission_requests (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.resubmission_requests enable row level security;

drop policy if exists "resub_req_select" on public.resubmission_requests;
create policy "resub_req_select" on public.resubmission_requests
for select to authenticated using (
  public.is_approved_user()
  and (
    student_id = auth.uid()
    or public.current_user_role() = 'admin'
    or exists (
      select 1 from public.assignments a
      join public.teaching_assignments ta on ta.id = a.teaching_assignment_id
      where a.id = resubmission_requests.assignment_id
        and ta.faculty_id = auth.uid()
    )
  )
);

-- Student asks for resubmission
create or replace function public.student_request_resubmission(
  p_submission_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sub record;
  v_faculty_id uuid;
  v_asg_title text;
  v_req_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if btrim(coalesce(p_reason, '')) = '' then raise exception 'Please enter a reason for resubmission'; end if;

  select s.id, s.assignment_id, s.student_id, a.title, ta.faculty_id
  into v_sub
  from public.submissions s
  join public.assignments a on a.id = s.assignment_id
  join public.teaching_assignments ta on ta.id = a.teaching_assignment_id
  where s.id = p_submission_id;

  if not found or v_sub.student_id <> v_uid then
    raise exception 'Submission not found';
  end if;

  if exists (
    select 1 from public.resubmission_requests
    where submission_id = p_submission_id and status = 'pending'
  ) then
    raise exception 'A resubmission request is already pending for this assignment';
  end if;

  insert into public.resubmission_requests (submission_id, assignment_id, student_id, reason)
  values (p_submission_id, v_sub.assignment_id, v_uid, btrim(p_reason))
  returning id into v_req_id;

  insert into public.notifications (user_id, title, body, is_read)
  values (v_sub.faculty_id, 'Resubmission Request', 'A student requested resubmission for "' || v_sub.title || '": ' || btrim(p_reason), false);

  return v_req_id;
end;
$$;

-- Faculty / Admin approves or rejects resubmission request
create or replace function public.review_resubmission_request(
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
  v_req record;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_decision not in ('approved', 'rejected') then raise exception 'Invalid decision'; end if;
  select role into v_role from public.profiles where id = v_uid and status = 'approved';

  select r.*, a.title as asg_title, ta.faculty_id
  into v_req
  from public.resubmission_requests r
  join public.assignments a on a.id = r.assignment_id
  join public.teaching_assignments ta on ta.id = a.teaching_assignment_id
  where r.id = p_request_id;

  if not found then raise exception 'Resubmission request not found'; end if;
  if v_role <> 'admin'::public.user_role and v_req.faculty_id <> v_uid then
    raise exception 'Not authorized to review this request';
  end if;

  update public.resubmission_requests
  set status = p_decision,
      reviewed_by = v_uid,
      reviewed_at = now()
  where id = p_request_id;

  if p_decision = 'approved' then
    update public.submissions
    set status = 'resubmission_requested'::public.submission_status,
        resubmission_allowed_after_due = true,
        updated_at = now()
    where id = v_req.submission_id;
  end if;

  insert into public.notifications (user_id, title, body, is_read)
  values (
    v_req.student_id,
    'Resubmission Request ' || initcap(p_decision),
    'Your resubmission request for "' || v_req.asg_title || '" was ' || p_decision || '.',
    false
  );
end;
$$;

-- 3. Faculty / Admin Extend Due Date RPC
create or replace function public.faculty_extend_assignment_due(
  p_assignment_id uuid,
  p_new_due_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_asg record;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select role into v_role from public.profiles where id = v_uid and status = 'approved';

  select a.id, a.due_at, ta.faculty_id
  into v_asg
  from public.assignments a
  join public.teaching_assignments ta on ta.id = a.teaching_assignment_id
  where a.id = p_assignment_id;

  if not found then raise exception 'Assignment not found'; end if;
  if v_role <> 'admin'::public.user_role and v_asg.faculty_id <> v_uid then
    raise exception 'Only assigned faculty or Admin can extend due dates';
  end if;

  update public.assignments
  set due_at = p_new_due_at,
      state = 'published',
      updated_at = now()
  where id = p_assignment_id;

  insert into public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by, reason)
  values (
    'assignments',
    p_assignment_id,
    'EXTEND_DUE_DATE',
    jsonb_build_object('due_at', v_asg.due_at),
    jsonb_build_object('due_at', p_new_due_at),
    v_uid,
    'Extended assignment due date'
  );
end;
$$;

-- 4. Update submit_assignment:
--    - Once submitted, a student cannot undo/overwrite unless faculty approves a resubmission (status = 'resubmission_requested').
--    - Other students who have not submitted yet can still submit before the due date even if marks were published for earlier students.
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
  v_has_sub := found;

  if v_is_late
     and not v_asg.allow_late_submission
     and not (v_has_sub and coalesce(v_sub.resubmission_allowed_after_due, false)) then
    raise exception 'Submission deadline has passed';
  end if;

  -- Once submitted, student cannot undo or overwrite unless Faculty approves a resubmission request.
  if v_has_sub and v_sub.status <> 'not_submitted' and v_sub.status <> 'resubmission_requested' then
    raise exception 'You have already submitted this assignment. Use "Ask Resubmission Request" if you need faculty approval to resubmit.';
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

revoke all on function public.set_mail_visibility(text) from public;
revoke all on function public.search_mail_directory(text) from public;
revoke all on function public.student_request_resubmission(uuid, text) from public;
revoke all on function public.review_resubmission_request(uuid, text) from public;
revoke all on function public.faculty_extend_assignment_due(uuid, timestamptz) from public;

grant execute on function public.set_mail_visibility(text) to authenticated;
grant execute on function public.search_mail_directory(text) to authenticated;
grant execute on function public.student_request_resubmission(uuid, text) to authenticated;
grant execute on function public.review_resubmission_request(uuid, text) to authenticated;
grant execute on function public.faculty_extend_assignment_due(uuid, timestamptz) to authenticated;
