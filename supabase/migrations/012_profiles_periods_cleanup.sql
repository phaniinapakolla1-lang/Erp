-- Migration 012: roll numbers, configurable periods, timetable clash protection, schema cleanup.
-- Run after 011. Safe to re-run.

-- 1. College periods live in the database (single source of truth for attendance + timetable)
alter table public.erp_settings
  add column if not exists class_periods jsonb not null default '[
    {"id":"1","label":"Period 1","start":"09:30","end":"10:30"},
    {"id":"2","label":"Period 2","start":"10:30","end":"11:30"},
    {"id":"3","label":"Period 3","start":"11:30","end":"12:30"},
    {"id":"4","label":"Period 4","start":"13:30","end":"14:30"},
    {"id":"5","label":"Period 5","start":"14:30","end":"15:30"},
    {"id":"6","label":"Period 6","start":"15:30","end":"16:30"}
  ]'::jsonb;

-- 2. Roll numbers: student_profiles / faculty_profiles had RLS enabled but no policies.
drop policy if exists "student_profiles_admin_all" on public.student_profiles;
drop policy if exists "student_profiles_read" on public.student_profiles;
drop policy if exists "faculty_profiles_admin_all" on public.faculty_profiles;
drop policy if exists "faculty_profiles_read_self" on public.faculty_profiles;

create policy "student_profiles_admin_all" on public.student_profiles
for all to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy "student_profiles_read" on public.student_profiles
for select to authenticated using (
  user_id = auth.uid()
  or exists (
    select 1 from public.enrollments e
    join public.teaching_assignments ta on ta.class_section_id = e.class_section_id
    where e.student_id = student_profiles.user_id and ta.faculty_id = auth.uid()
  )
  or (public.current_user_role() = 'hod' and exists (
    select 1 from public.profiles p where p.id = student_profiles.user_id and p.department_id = public.current_user_dept()
  ))
);

create policy "faculty_profiles_admin_all" on public.faculty_profiles
for all to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

create policy "faculty_profiles_read_self" on public.faculty_profiles
for select to authenticated using (user_id = auth.uid());

-- 3. Timetable clash protection (same faculty, class section or room overlapping on the same day)
create or replace function public.check_slot_clash()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_faculty uuid;
  v_section uuid;
begin
  if new.end_time <= new.start_time then
    raise exception 'End time must be after start time';
  end if;
  select faculty_id, class_section_id into v_faculty, v_section
  from public.teaching_assignments where id = new.teaching_assignment_id;

  if exists (
    select 1
    from public.weekly_schedule_slots w
    join public.teaching_assignments t on t.id = w.teaching_assignment_id
    where w.id is distinct from new.id
      and w.day_of_week = new.day_of_week
      and w.start_time < new.end_time and new.start_time < w.end_time
      and (
        t.faculty_id = v_faculty
        or t.class_section_id = v_section
        or (new.room is not null and btrim(new.room) <> '' and lower(btrim(w.room)) = lower(btrim(new.room)))
      )
  ) then
    raise exception 'Timetable clash: faculty, class or room is already booked in that time range';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_slot_clash on public.weekly_schedule_slots;
create trigger trg_check_slot_clash
before insert or update on public.weekly_schedule_slots
for each row execute function public.check_slot_clash();

-- 4. Remove leftovers of the old upload / Sheets design (nothing in the app uses them)
alter table public.submission_versions drop column if exists drive_file_ref_id;
alter table public.assignments drop column if exists attachment_file_id;
alter table public.assignments drop column if exists allowed_extensions;
alter table public.erp_settings drop column if exists max_upload_mb;
drop table if exists public.drive_files cascade;
drop table if exists public.backup_sync_logs cascade;
