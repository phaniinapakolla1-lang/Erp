-- Migration 027: Exam Controller Role, Database-Stored College Branding, Printable Hall Tickets, Results & Auto-Supplementary
-- Run in Supabase Dashboard -> SQL Editor. Safe to re-run.

-- 1. Add exam_controller role to user_role enum
alter type public.user_role add value if not exists 'exam_controller';

-- 2. Official uniform photo (Drive link) on profiles
alter table public.profiles
  add column if not exists photo_drive_url text;

-- Extend update_own_profile to include p_photo_drive_url (keep exact parameter list clean)
drop function if exists public.update_own_profile(text, text, text, date, text, text, text, text, text, text);
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
  p_blood_group text default null,
  p_photo_drive_url text default null
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
      photo_drive_url = nullif(btrim(coalesce(p_photo_drive_url, '')), ''),
      updated_at = now()
  where id = v_uid
  returning * into v_row;

  if not found then raise exception 'Profile not found'; end if;
  return v_row;
end;
$$;

-- 3. Database-stored College Branding (Name, Logo, Principal Sign, Stamp, Hall Ticket Template) in erp_settings
alter table public.erp_settings
  add column if not exists college_subtitle text default 'Autonomous College · Self-Center Examinations',
  add column if not exists college_address text default '',
  add column if not exists college_logo_data text,
  add column if not exists principal_sign_data text,
  add column if not exists college_stamp_data text,
  add column if not exists default_exam_instructions text default E'1. Carry this Hall Ticket and your College ID card to the examination hall.\n2. Report to the exam hall at least 15 minutes before the scheduled start time.\n3. Mobile phones, smartwatches, and unauthorized electronic devices are strictly prohibited.\n4. Verify your Name, Roll Number, and Subject list before signing the Hall Ticket.',
  add column if not exists hall_ticket_template jsonb;

create or replace function public.admin_save_college_branding(
  p_college_name text,
  p_college_subtitle text default null,
  p_college_address text default null,
  p_college_logo_data text default null,
  p_principal_sign_data text default null,
  p_college_stamp_data text default null,
  p_default_exam_instructions text default null,
  p_hall_ticket_template jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select role::text into v_role from public.profiles where id = auth.uid() and status = 'approved';
  if v_role is null or v_role not in ('admin', 'exam_controller') then
    raise exception 'Only Admin or Exam Controller can update branding and hall ticket settings';
  end if;

  insert into public.erp_settings (id, college_name)
  values (1, coalesce(nullif(btrim(p_college_name), ''), 'College ERP'))
  on conflict (id) do update
  set college_name = coalesce(nullif(btrim(p_college_name), ''), erp_settings.college_name),
      college_subtitle = coalesce(p_college_subtitle, erp_settings.college_subtitle),
      college_address = coalesce(p_college_address, erp_settings.college_address),
      college_logo_data = case when p_college_logo_data is not null then nullif(p_college_logo_data, '') else erp_settings.college_logo_data end,
      principal_sign_data = case when p_principal_sign_data is not null then nullif(p_principal_sign_data, '') else erp_settings.principal_sign_data end,
      college_stamp_data = case when p_college_stamp_data is not null then nullif(p_college_stamp_data, '') else erp_settings.college_stamp_data end,
      default_exam_instructions = coalesce(p_default_exam_instructions, erp_settings.default_exam_instructions),
      hall_ticket_template = coalesce(p_hall_ticket_template, erp_settings.hall_ticket_template),
      updated_at = now();
end;
$$;

-- 4. Grant exam_controller read visibility on profiles, student_profiles, enrollments, attendance
drop policy if exists "profiles_select_exam_controller" on public.profiles;
create policy "profiles_select_exam_controller" on public.profiles
for select to authenticated using (public.current_user_role()::text = 'exam_controller');

drop policy if exists "student_profiles_select_exam_controller" on public.student_profiles;
create policy "student_profiles_select_exam_controller" on public.student_profiles
for select to authenticated using (public.current_user_role()::text = 'exam_controller');

drop policy if exists "enrollments_select_exam_controller" on public.enrollments;
create policy "enrollments_select_exam_controller" on public.enrollments
for select to authenticated using (public.current_user_role()::text = 'exam_controller');

drop policy if exists "ta_select_exam_controller" on public.teaching_assignments;
create policy "ta_select_exam_controller" on public.teaching_assignments
for select to authenticated using (public.current_user_role()::text = 'exam_controller');

drop policy if exists "att_sessions_select_exam_controller" on public.attendance_sessions;
create policy "att_sessions_select_exam_controller" on public.attendance_sessions
for select to authenticated using (public.current_user_role()::text = 'exam_controller');

drop policy if exists "att_records_select_exam_controller" on public.attendance_records;
create policy "att_records_select_exam_controller" on public.attendance_records
for select to authenticated using (public.current_user_role()::text = 'exam_controller');

-- Allow exam_controller to read and post official exam/results announcements
drop policy if exists "ann_select" on public.announcements;
create policy "ann_select" on public.announcements
for select to authenticated using (
  public.is_approved_user()
  and (
    public.current_user_role()::text in ('admin', 'exam_controller')
    or created_by = auth.uid()
    or (
      (target_role = 'all' or target_role = public.current_user_role()::text)
      and (department_id is null or department_id = public.current_user_dept())
    )
  )
);

drop policy if exists "ann_insert" on public.announcements;
create policy "ann_insert" on public.announcements
for insert to authenticated with check (
  public.is_approved_user()
  and created_by = auth.uid()
  and public.current_user_role()::text in ('admin', 'hod', 'faculty', 'exam_controller')
);

-- Allow exam_controller to publish exam dates on the Academic Calendar
drop policy if exists "cal_manage_exam_controller" on public.calendar_events;
create policy "cal_manage_exam_controller" on public.calendar_events
for all to authenticated using (public.current_user_role()::text = 'exam_controller')
with check (public.current_user_role()::text = 'exam_controller');

-- 5. Exam Cycles, Hall Tickets & Exam Results tables
create table if not exists public.exam_cycles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  semester_label text not null default 'Semester 1',
  exam_type text not null default 'regular' check (exam_type in ('regular', 'supplementary')),
  max_marks numeric(6,2) not null default 100 check (max_marks > 0),
  min_pass_marks numeric(6,2) not null default 40 check (min_pass_marks >= 0),
  instructions text,
  results_published boolean not null default false,
  results_external_url text,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.exam_hall_tickets (
  id uuid primary key default gen_random_uuid(),
  exam_cycle_id uuid not null references public.exam_cycles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  hall_ticket_no text not null,
  chk_biodata boolean not null default false,
  chk_photo boolean not null default false,
  chk_attendance boolean not null default false,
  chk_fee boolean not null default false,
  chk_subjects boolean not null default false,
  is_approved boolean not null default false,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  regular_subjects jsonb not null default '[]'::jsonb,
  supplementary_subjects jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_cycle_id, student_id)
);

create table if not exists public.exam_results (
  id uuid primary key default gen_random_uuid(),
  exam_cycle_id uuid not null references public.exam_cycles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  marks_obtained numeric(6,2),
  max_marks numeric(6,2) not null default 100,
  pass_marks numeric(6,2) not null default 40,
  status text not null check (status in ('pass', 'fail', 'absent')),
  is_published boolean not null default false,
  entered_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (exam_cycle_id, student_id, subject_id)
);

alter table public.exam_cycles enable row level security;
alter table public.exam_hall_tickets enable row level security;
alter table public.exam_results enable row level security;

drop policy if exists "exam_cycles_read" on public.exam_cycles;
create policy "exam_cycles_read" on public.exam_cycles
for select to authenticated using (public.is_approved_user());

drop policy if exists "exam_cycles_manage" on public.exam_cycles;
create policy "exam_cycles_manage" on public.exam_cycles
for all to authenticated using (public.current_user_role()::text in ('admin', 'exam_controller'))
with check (public.current_user_role()::text in ('admin', 'exam_controller'));

drop policy if exists "hall_tickets_read" on public.exam_hall_tickets;
create policy "hall_tickets_read" on public.exam_hall_tickets
for select to authenticated using (
  public.is_approved_user()
  and (
    public.current_user_role()::text in ('admin', 'exam_controller')
    or (student_id = auth.uid() and is_approved = true)
  )
);

drop policy if exists "hall_tickets_manage" on public.exam_hall_tickets;
create policy "hall_tickets_manage" on public.exam_hall_tickets
for all to authenticated using (public.current_user_role()::text in ('admin', 'exam_controller'))
with check (public.current_user_role()::text in ('admin', 'exam_controller'));

drop policy if exists "exam_results_read" on public.exam_results;
create policy "exam_results_read" on public.exam_results
for select to authenticated using (
  public.is_approved_user()
  and (
    public.current_user_role()::text in ('admin', 'exam_controller', 'hod')
    or (student_id = auth.uid() and is_published = true)
  )
);

drop policy if exists "exam_results_manage" on public.exam_results;
create policy "exam_results_manage" on public.exam_results
for all to authenticated using (public.current_user_role()::text in ('admin', 'exam_controller'))
with check (public.current_user_role()::text in ('admin', 'exam_controller'));

-- 6. Publish Results & Auto-Generate Supplementary Hall Tickets for Failed/Absent Students
create or replace function public.publish_exam_results_and_auto_supp(
  p_exam_cycle_id uuid,
  p_external_url text default null,
  p_auto_generate_supp boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_cycle record;
  v_supp_cycle_id uuid;
  v_stu record;
  v_supp_list jsonb;
  v_generated_count int := 0;
  v_roll text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select role::text into v_role from public.profiles where id = auth.uid() and status = 'approved';
  if v_role is null or v_role not in ('admin', 'exam_controller') then
    raise exception 'Only Admin or Exam Controller can publish exam results';
  end if;

  select * into v_cycle from public.exam_cycles where id = p_exam_cycle_id;
  if not found then raise exception 'Exam cycle not found'; end if;

  update public.exam_results
  set is_published = true, updated_at = now()
  where exam_cycle_id = p_exam_cycle_id;

  update public.exam_cycles
  set results_published = true,
      results_external_url = nullif(btrim(coalesce(p_external_url, '')), ''),
      published_at = now()
  where id = p_exam_cycle_id;

  -- Post official Announcement with Results Link
  insert into public.announcements (title, body, target_role, created_by)
  values (
    'Results Published: ' || v_cycle.title,
    'Examination results for ' || v_cycle.title || ' (' || v_cycle.semester_label || ') have been published. View your marks under Exam Centre & Results' ||
      case when nullif(btrim(coalesce(p_external_url, '')), '') is not null then ' or open the official link: ' || btrim(p_external_url) else '.' end,
    'student',
    auth.uid()
  );

  -- Notify all students whose results were just published
  insert into public.notifications (user_id, title, body, link_url, is_read)
  select distinct
    er.student_id,
    'Exam Results Published: ' || v_cycle.title,
    'Your results for ' || v_cycle.title || ' (' || v_cycle.semester_label || ') are now live. Open Hall Tickets & Results to view.',
    '/student/exams',
    false
  from public.exam_results er
  where er.exam_cycle_id = p_exam_cycle_id;

  -- Auto-generate Supplementary Hall Tickets for students who Failed or were Absent
  if p_auto_generate_supp then
    select id into v_supp_cycle_id
    from public.exam_cycles
    where title = v_cycle.title || ' — Supplementary' and exam_type = 'supplementary'
    limit 1;

    if v_supp_cycle_id is null then
      insert into public.exam_cycles (title, semester_label, exam_type, max_marks, min_pass_marks, instructions, created_by)
      values (
        v_cycle.title || ' — Supplementary',
        v_cycle.semester_label,
        'supplementary',
        v_cycle.max_marks,
        v_cycle.min_pass_marks,
        v_cycle.instructions,
        auth.uid()
      )
      returning id into v_supp_cycle_id;
    end if;

    for v_stu in
      select distinct student_id
      from public.exam_results
      where exam_cycle_id = p_exam_cycle_id and status in ('fail', 'absent')
    loop
      select jsonb_agg(jsonb_build_object('code', s.code, 'name', s.name, 'type', coalesce(s.subject_type, 'theory'), 'exam_date', 'TBA'))
      into v_supp_list
      from public.exam_results er
      join public.subjects s on s.id = er.subject_id
      where er.exam_cycle_id = p_exam_cycle_id
        and er.student_id = v_stu.student_id
        and er.status in ('fail', 'absent');

      select coalesce(roll_no, left(v_stu.student_id::text, 8)) into v_roll
      from public.student_profiles where user_id = v_stu.student_id;

      insert into public.exam_hall_tickets (
        exam_cycle_id, student_id, hall_ticket_no,
        chk_subjects, is_approved, approved_by, approved_at,
        regular_subjects, supplementary_subjects
      ) values (
        v_supp_cycle_id,
        v_stu.student_id,
        'SUPP-' || upper(coalesce(v_roll, left(v_stu.student_id::text, 6))),
        true, true, auth.uid(), now(),
        '[]'::jsonb,
        coalesce(v_supp_list, '[]'::jsonb)
      )
      on conflict (exam_cycle_id, student_id) do update
      set supplementary_subjects = excluded.supplementary_subjects,
          is_approved = true,
          approved_by = auth.uid(),
          approved_at = now(),
          updated_at = now();

      v_generated_count := v_generated_count + 1;

      insert into public.notifications (user_id, title, body, link_url, is_read)
      values (
        v_stu.student_id,
        'Supplementary Hall Ticket Generated',
        'A Supplementary Hall Ticket has been auto-generated for ' || v_cycle.title || '. Open Hall Tickets & Results to view and print.',
        '/student/exams',
        false
      );
    end loop;
  end if;

  return jsonb_build_object('published', true, 'supplementary_hall_tickets_generated', v_generated_count, 'supp_cycle_id', v_supp_cycle_id);
end;
$$;

revoke all on function public.update_own_profile(text, text, text, date, text, text, text, text, text, text, text) from public;
revoke all on function public.admin_save_college_branding(text, text, text, text, text, text, text, jsonb) from public;
revoke all on function public.publish_exam_results_and_auto_supp(uuid, text, boolean) from public;

grant execute on function public.update_own_profile(text, text, text, date, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.admin_save_college_branding(text, text, text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.publish_exam_results_and_auto_supp(uuid, text, boolean) to authenticated;
