-- Migration 014: Profile personal details, 50-icon avatar support & reliable Admin Department/Roll No RPC
-- Safe to re-run.

alter table public.profiles
  add column if not exists gender text,
  add column if not exists dob date,
  add column if not exists address text,
  add column if not exists bio text,
  add column if not exists avatar_icon text not null default '🎓';

-- Safe self-update RPC: users can only update their own personal details (never role, status, or department_id)
create or replace function public.update_own_profile(
  p_full_name text,
  p_mobile text default null,
  p_gender text default null,
  p_dob date default null,
  p_address text default null,
  p_bio text default null,
  p_avatar_icon text default '🎓'
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.profiles;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if p_full_name is null or btrim(p_full_name) = '' then
    raise exception 'Full name is required';
  end if;

  update public.profiles
  set full_name = btrim(p_full_name),
      mobile = nullif(btrim(coalesce(p_mobile, '')), ''),
      gender = nullif(btrim(coalesce(p_gender, '')), ''),
      dob = p_dob,
      address = nullif(btrim(coalesce(p_address, '')), ''),
      bio = nullif(btrim(coalesce(p_bio, '')), ''),
      avatar_icon = coalesce(nullif(btrim(coalesce(p_avatar_icon, '')), ''), '🎓'),
      updated_at = now()
  where id = v_uid
  returning * into v_row;

  if not found then
    raise exception 'Profile not found';
  end if;

  return v_row;
end;
$$;

-- Admin-only RPC to reliably save Department + Student Roll No in one transaction
create or replace function public.admin_update_user_academic(
  p_user_id uuid,
  p_department_id uuid default null,
  p_roll_no text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_target_role public.user_role;
  v_roll text := nullif(btrim(coalesce(p_roll_no, '')), '');
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select role into v_role from public.profiles where id = auth.uid() and status = 'approved';
  if v_role is distinct from 'admin'::public.user_role then
    raise exception 'Only Admin can assign departments and roll numbers';
  end if;

  select role into v_target_role from public.profiles where id = p_user_id;
  if not found then raise exception 'User profile not found'; end if;

  update public.profiles
  set department_id = p_department_id,
      updated_at = now()
  where id = p_user_id;

  if v_target_role = 'student'::public.user_role and v_roll is not null then
    insert into public.student_profiles (user_id, roll_no, student_code, admission_year)
    values (p_user_id, v_roll, v_roll, extract(year from now())::int)
    on conflict (user_id) do update
    set roll_no = excluded.roll_no,
        student_code = excluded.student_code;
  end if;
end;
$$;

revoke all on function public.update_own_profile(text, text, text, date, text, text, text) from public;
revoke all on function public.admin_update_user_academic(uuid, uuid, text) from public;
grant execute on function public.update_own_profile(text, text, text, date, text, text, text) to authenticated;
grant execute on function public.admin_update_user_academic(uuid, uuid, text) to authenticated;
