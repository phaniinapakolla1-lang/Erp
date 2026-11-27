-- Migration 026: Admin Delete Departments/Subjects, Save Periods RPC, Subject Credits Update, & Force-Delete User
-- Safe to re-run.

alter table public.erp_settings
  add column if not exists class_periods jsonb;

-- 1. Admin Save Periods RPC (fixes period add/remove reliably)
create or replace function public.admin_save_periods(p_periods jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select role into v_role from public.profiles where id = auth.uid() and status = 'approved';
  if v_role is distinct from 'admin'::public.user_role then
    raise exception 'Only Admin can modify class periods';
  end if;

  if p_periods is null or jsonb_typeof(p_periods) <> 'array' or jsonb_array_length(p_periods) = 0 then
    raise exception 'At least one period is required';
  end if;

  insert into public.erp_settings (id, class_periods)
  values (1, p_periods)
  on conflict (id) do update
  set class_periods = excluded.class_periods,
      updated_at = now();
end;
$$;

-- 2. Admin Delete Department RPC
create or replace function public.admin_delete_department(p_dept_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select role into v_role from public.profiles where id = auth.uid() and status = 'approved';
  if v_role is distinct from 'admin'::public.user_role then
    raise exception 'Only Admin can delete departments';
  end if;

  update public.profiles set department_id = null where department_id = p_dept_id;
  delete from public.specializations where department_id = p_dept_id;
  delete from public.subjects where department_id = p_dept_id;
  delete from public.departments where id = p_dept_id;
exception
  when foreign_key_violation then
    raise exception 'Cannot delete department while active classes, teaching assignments, or attendance records still reference its subjects/programs. Remove those assignments first.';
end;
$$;

-- 3. Admin Delete Subject RPC
create or replace function public.admin_delete_subject(p_subject_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select role into v_role from public.profiles where id = auth.uid() and status = 'approved';
  if v_role is distinct from 'admin'::public.user_role then
    raise exception 'Only Admin can delete subjects';
  end if;

  delete from public.subjects where id = p_subject_id;
exception
  when foreign_key_violation then
    raise exception 'Cannot delete subject because it is assigned to a faculty/class. Remove the faculty assignment in Step 4 first.';
end;
$$;

-- 4. Admin Update Subject Credits RPC
create or replace function public.admin_update_subject_credits(
  p_subject_id uuid,
  p_credits numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select role into v_role from public.profiles where id = auth.uid() and status = 'approved';
  if v_role is distinct from 'admin'::public.user_role then
    raise exception 'Only Admin can update subject credits';
  end if;
  if p_credits is null or p_credits < 0 or p_credits > 30 then
    raise exception 'Credits must be between 0 and 30';
  end if;

  update public.subjects
  set credits = p_credits
  where id = p_subject_id;
end;
$$;

-- 5. Upgraded Admin Delete User RPC (cleans up dependent rows cleanly)
create or replace function public.admin_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_caller_role public.user_role;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select role into v_caller_role from public.profiles where id = auth.uid() and status = 'approved';
  if v_caller_role is distinct from 'admin'::public.user_role then
    raise exception 'Only Admin can delete users';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'You cannot delete your own Admin account';
  end if;

  delete from public.attendance_correction_requests where student_id = p_user_id or requested_by = p_user_id or reviewed_by = p_user_id;
  delete from public.attendance_records where student_id = p_user_id;
  delete from public.attendance_sessions where recorded_by = p_user_id;
  delete from public.resubmission_requests where student_id = p_user_id or reviewed_by = p_user_id;
  delete from public.evaluations where evaluated_by = p_user_id or submission_id in (select id from public.submissions where student_id = p_user_id);
  delete from public.submissions where student_id = p_user_id;
  delete from public.assignments where created_by = p_user_id;
  delete from public.enrollments where student_id = p_user_id;
  delete from public.teaching_assignments where faculty_id = p_user_id;
  delete from public.calendar_events where created_by = p_user_id;
  delete from public.audit_logs where changed_by = p_user_id;

  delete from auth.users where id = p_user_id;
  if not found then
    delete from public.profiles where id = p_user_id;
  end if;
end;
$$;

revoke all on function public.admin_save_periods(jsonb) from public;
revoke all on function public.admin_delete_department(uuid) from public;
revoke all on function public.admin_delete_subject(uuid) from public;
revoke all on function public.admin_update_subject_credits(uuid, numeric) from public;
revoke all on function public.admin_delete_user(uuid) from public;

grant execute on function public.admin_save_periods(jsonb) to authenticated;
grant execute on function public.admin_delete_department(uuid) to authenticated;
grant execute on function public.admin_delete_subject(uuid) to authenticated;
grant execute on function public.admin_update_subject_credits(uuid, numeric) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;
