-- Migration 015: Full Admin User CRUD (Create Finalize, Update, Delete)
-- Safe to re-run.

create or replace function public.admin_finalize_created_user(
  p_user_id uuid,
  p_full_name text,
  p_mobile text default null,
  p_role public.user_role default 'student',
  p_status public.account_status default 'approved',
  p_department_id uuid default null,
  p_roll_no text default null,
  p_class_section_id uuid default null,
  p_gender text default null,
  p_dob date default null,
  p_address text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_caller_role public.user_role;
  v_roll text := nullif(btrim(coalesce(p_roll_no, '')), '');
  v_email text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select role into v_caller_role from public.profiles where id = auth.uid() and status = 'approved';
  if v_caller_role is distinct from 'admin'::public.user_role then
    raise exception 'Only Admin can create users';
  end if;

  select email into v_email from auth.users where id = p_user_id;
  if not found then
    raise exception 'Auth user not found for id %', p_user_id;
  end if;

  -- Confirm email immediately so Admin-created users can log in right away
  update auth.users
  set email_confirmed_at = coalesce(email_confirmed_at, now())
  where id = p_user_id;

  insert into public.profiles (id, full_name, email, mobile, role, status, department_id, gender, dob, address)
  values (
    p_user_id,
    btrim(p_full_name),
    v_email,
    nullif(btrim(coalesce(p_mobile, '')), ''),
    p_role,
    p_status,
    p_department_id,
    nullif(btrim(coalesce(p_gender, '')), ''),
    p_dob,
    nullif(btrim(coalesce(p_address, '')), '')
  )
  on conflict (id) do update
  set full_name = excluded.full_name,
      mobile = excluded.mobile,
      role = excluded.role,
      status = excluded.status,
      department_id = excluded.department_id,
      gender = excluded.gender,
      dob = excluded.dob,
      address = excluded.address,
      updated_at = now();

  if p_role = 'student'::public.user_role and v_roll is not null then
    insert into public.student_profiles (user_id, roll_no, student_code, admission_year)
    values (p_user_id, v_roll, v_roll, extract(year from now())::int)
    on conflict (user_id) do update
    set roll_no = excluded.roll_no,
        student_code = excluded.student_code;
  end if;

  if p_role = 'student'::public.user_role and p_class_section_id is not null then
    insert into public.enrollments (student_id, class_section_id, is_active)
    values (p_user_id, p_class_section_id, true)
    on conflict (student_id, class_section_id) do update
    set is_active = true;
  end if;
end;
$$;

create or replace function public.admin_update_user(
  p_user_id uuid,
  p_full_name text,
  p_mobile text default null,
  p_role public.user_role default 'student',
  p_status public.account_status default 'approved',
  p_department_id uuid default null,
  p_roll_no text default null,
  p_class_section_id uuid default null,
  p_gender text default null,
  p_dob date default null,
  p_address text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role public.user_role;
  v_roll text := nullif(btrim(coalesce(p_roll_no, '')), '');
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select role into v_caller_role from public.profiles where id = auth.uid() and status = 'approved';
  if v_caller_role is distinct from 'admin'::public.user_role then
    raise exception 'Only Admin can update users';
  end if;

  if p_full_name is null or btrim(p_full_name) = '' then
    raise exception 'Full name is required';
  end if;

  if p_user_id = auth.uid() and (p_role <> 'admin'::public.user_role or p_status <> 'approved'::public.account_status) then
    raise exception 'You cannot demote or disable your own Admin account';
  end if;

  update public.profiles
  set full_name = btrim(p_full_name),
      mobile = nullif(btrim(coalesce(p_mobile, '')), ''),
      role = p_role,
      status = p_status,
      department_id = p_department_id,
      gender = nullif(btrim(coalesce(p_gender, '')), ''),
      dob = p_dob,
      address = nullif(btrim(coalesce(p_address, '')), ''),
      updated_at = now()
  where id = p_user_id;

  if not found then
    raise exception 'User profile not found';
  end if;

  if p_role = 'student'::public.user_role and v_roll is not null then
    insert into public.student_profiles (user_id, roll_no, student_code, admission_year)
    values (p_user_id, v_roll, v_roll, extract(year from now())::int)
    on conflict (user_id) do update
    set roll_no = excluded.roll_no,
        student_code = excluded.student_code;
  end if;

  if p_role = 'student'::public.user_role and p_class_section_id is not null then
    update public.enrollments
    set is_active = false
    where student_id = p_user_id and class_section_id <> p_class_section_id and is_active = true;

    insert into public.enrollments (student_id, class_section_id, is_active)
    values (p_user_id, p_class_section_id, true)
    on conflict (student_id, class_section_id) do update
    set is_active = true;
  end if;
end;
$$;

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

  delete from auth.users where id = p_user_id;
  if not found then
    delete from public.profiles where id = p_user_id;
  end if;
exception
  when foreign_key_violation then
    raise exception 'Cannot delete user because they have linked teaching assignments, attendance sessions, or graded submissions. Disable the account or remove their assignments first.';
end;
$$;

revoke all on function public.admin_finalize_created_user(uuid, text, text, public.user_role, public.account_status, uuid, text, uuid, text, date, text) from public;
revoke all on function public.admin_update_user(uuid, text, text, public.user_role, public.account_status, uuid, text, uuid, text, date, text) from public;
revoke all on function public.admin_delete_user(uuid) from public;

grant execute on function public.admin_finalize_created_user(uuid, text, text, public.user_role, public.account_status, uuid, text, uuid, text, date, text) to authenticated;
grant execute on function public.admin_update_user(uuid, text, text, public.user_role, public.account_status, uuid, text, uuid, text, date, text) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;
