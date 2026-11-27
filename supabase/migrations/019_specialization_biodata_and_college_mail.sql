-- Migration 019: Specializations, Student Bio-Data Fields, and College Internal/External Mail System with Safety Logs
-- Safe to re-run.

-- 1. Specializations table (per Department)
create table if not exists public.specializations (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.specializations enable row level security;

drop policy if exists "spec_read_approved" on public.specializations;
create policy "spec_read_approved" on public.specializations
for select to authenticated using (public.is_approved_user());

drop policy if exists "spec_write_admin" on public.specializations;
create policy "spec_write_admin" on public.specializations
for all to authenticated using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

-- Optional specialization link on subjects
alter table public.subjects
  add column if not exists specialization_id uuid references public.specializations(id) on delete set null;

-- 2. Student Bio-Data & Specialization fields on profiles
alter table public.profiles
  add column if not exists specialization_id uuid references public.specializations(id) on delete set null,
  add column if not exists guardian_name text,
  add column if not exists guardian_phone text,
  add column if not exists blood_group text;

-- Safe self-update RPC (extended with guardian_name, guardian_phone, blood_group; never touches role/status/dept/specialization/roll)
create or replace function public.update_own_profile(
  p_full_name text,
  p_mobile text default null,
  p_gender text default null,
  p_dob date default null,
  p_address text default null,
  p_bio text default null,
  p_avatar_icon text default '🎓',
  p_guardian_name text default null,
  p_guardian_phone text default null,
  p_blood_group text default null
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
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_full_name is null or btrim(p_full_name) = '' then raise exception 'Full name is required'; end if;

  update public.profiles
  set full_name = btrim(p_full_name),
      mobile = nullif(btrim(coalesce(p_mobile, '')), ''),
      gender = nullif(btrim(coalesce(p_gender, '')), ''),
      dob = p_dob,
      address = nullif(btrim(coalesce(p_address, '')), ''),
      bio = nullif(btrim(coalesce(p_bio, '')), ''),
      avatar_icon = coalesce(nullif(btrim(coalesce(p_avatar_icon, '')), ''), '🎓'),
      guardian_name = nullif(btrim(coalesce(p_guardian_name, '')), ''),
      guardian_phone = nullif(btrim(coalesce(p_guardian_phone, '')), ''),
      blood_group = nullif(btrim(coalesce(p_blood_group, '')), ''),
      updated_at = now()
  where id = v_uid
  returning * into v_row;

  if not found then raise exception 'Profile not found'; end if;
  return v_row;
end;
$$;

revoke all on function public.update_own_profile(text, text, text, date, text, text, text, text, text, text) from public;
grant execute on function public.update_own_profile(text, text, text, date, text, text, text, text, text, text) to authenticated;

-- Admin-only RPC to set student's Specialization + Admission Year (alongside Dept & Roll No)
create or replace function public.admin_set_student_academic_meta(
  p_user_id uuid,
  p_specialization_id uuid default null,
  p_admission_year int default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role public.user_role;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select role into v_caller_role from public.profiles where id = auth.uid() and status = 'approved';
  if v_caller_role is distinct from 'admin'::public.user_role then
    raise exception 'Only Admin can assign specializations and academic years';
  end if;

  update public.profiles
  set specialization_id = p_specialization_id,
      updated_at = now()
  where id = p_user_id;

  if p_admission_year is not null then
    update public.student_profiles
    set admission_year = p_admission_year
    where user_id = p_user_id;
  end if;
end;
$$;

revoke all on function public.admin_set_student_academic_meta(uuid, uuid, int) from public;
grant execute on function public.admin_set_student_academic_meta(uuid, uuid, int) to authenticated;

-- 3. College Internal & External Mail System + Safety Logs
create table if not exists public.college_mails (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  sender_email text not null,
  recipient_email text not null,
  recipient_id uuid references public.profiles(id) on delete set null,
  mail_scope text not null check (mail_scope in ('internal', 'external')),
  subject text not null,
  body text not null,
  is_read boolean not null default false,
  delivery_status text not null default 'delivered',
  created_at timestamptz not null default now()
);

create table if not exists public.college_mail_logs (
  id uuid primary key default gen_random_uuid(),
  mail_id uuid not null references public.college_mails(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  sender_email text not null,
  recipient_email text not null,
  mail_scope text not null,
  subject text not null,
  action text not null default 'sent',
  created_at timestamptz not null default now()
);

alter table public.college_mails enable row level security;
alter table public.college_mail_logs enable row level security;

drop policy if exists "mail_select" on public.college_mails;
create policy "mail_select" on public.college_mails
for select to authenticated using (
  public.is_approved_user()
  and (
    sender_id = auth.uid()
    or recipient_id = auth.uid()
    or public.current_user_role() = 'admin'
  )
);

drop policy if exists "mail_update_read" on public.college_mails;
create policy "mail_update_read" on public.college_mails
for update to authenticated using (
  public.is_approved_user() and recipient_id = auth.uid()
) with check (
  public.is_approved_user() and recipient_id = auth.uid()
);

drop policy if exists "mail_logs_select" on public.college_mail_logs;
create policy "mail_logs_select" on public.college_mail_logs
for select to authenticated using (
  public.is_approved_user()
  and (
    sender_id = auth.uid()
    or public.current_user_role() = 'admin'
  )
);

create or replace function public.send_college_mail(
  p_recipient_email text,
  p_subject text,
  p_body text
)
returns public.college_mails
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sender_email text;
  v_sender_name text;
  v_rec_id uuid;
  v_rec_email text := lower(btrim(coalesce(p_recipient_email, '')));
  v_scope text;
  v_status text;
  v_mail public.college_mails;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.is_approved_user() then raise exception 'Approved account required'; end if;
  if v_rec_email = '' or position('@' in v_rec_email) = 0 then raise exception 'Valid recipient email is required'; end if;
  if btrim(coalesce(p_subject, '')) = '' then raise exception 'Subject is required'; end if;
  if btrim(coalesce(p_body, '')) = '' then raise exception 'Message body is required'; end if;

  select email, full_name into v_sender_email, v_sender_name from public.profiles where id = v_uid;
  select id into v_rec_id from public.profiles where lower(email) = v_rec_email and status = 'approved' limit 1;

  if v_rec_id is not null then
    v_scope := 'internal';
    v_status := 'delivered';
  else
    v_scope := 'external';
    v_status := 'logged_external';
  end if;

  insert into public.college_mails (
    sender_id, sender_email, recipient_email, recipient_id, mail_scope, subject, body, delivery_status
  ) values (
    v_uid, v_sender_email, v_rec_email, v_rec_id, v_scope, btrim(p_subject), btrim(p_body), v_status
  )
  returning * into v_mail;

  insert into public.college_mail_logs (
    mail_id, sender_id, sender_email, recipient_email, mail_scope, subject, action
  ) values (
    v_mail.id, v_uid, v_sender_email, v_rec_email, v_scope, btrim(p_subject),
    case when v_scope = 'internal' then 'sent_internal' else 'sent_external_logged' end
  );

  if v_rec_id is not null and v_rec_id <> v_uid then
    insert into public.notifications (user_id, title, body, is_read)
    values (v_rec_id, 'New College Mail from ' || coalesce(v_sender_name, v_sender_email), btrim(p_subject), false);
  end if;

  return v_mail;
end;
$$;

revoke all on function public.send_college_mail(text, text, text) from public;
grant execute on function public.send_college_mail(text, text, text) to authenticated;
