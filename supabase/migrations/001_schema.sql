-- College ERP — Core PostgreSQL Schema (18 Tables)
-- Enforces single source of truth, referential integrity, duplicate prevention, and audit trails.

create extension if not exists "pgcrypto";

-- 1. Enums
create type user_role as enum ('admin', 'hod', 'faculty', 'student');
create type account_status as enum ('pending', 'approved', 'rejected', 'disabled');
create type attendance_status as enum ('present', 'absent', 'late');
create type session_status as enum ('conducted', 'cancelled');
create type assignment_state as enum ('draft', 'published', 'closed', 'archived');
create type submission_status as enum ('not_submitted', 'submitted', 'late', 'under_evaluation', 'evaluated', 'resubmission_requested');
create type evaluation_status as enum ('not_evaluated', 'draft', 'evaluated', 'published');

-- 2. Institutional Settings (1-row config)
create table erp_settings (
  id int primary key default 1 check (id = 1),
  college_name text not null default 'College ERP',
  late_counts_as_present boolean not null default true,
  attendance_edit_window_hours int not null default 24,
  max_upload_mb int not null default 10,
  updated_at timestamptz not null default now()
);
insert into erp_settings (id) values (1) on conflict do nothing;

-- 3. Academic Structure
create table departments (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  created_at timestamptz not null default now()
);

create table programs (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments(id) on delete restrict,
  code text unique not null,
  name text not null,
  duration_years int not null default 3,
  created_at timestamptz not null default now()
);

create table academic_years (
  id uuid primary key default gen_random_uuid(),
  label text unique not null, -- e.g. '2026-27'
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false
);

create table semesters (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references academic_years(id) on delete restrict,
  number int not null check (number between 1 and 12),
  label text not null, -- e.g. 'Semester 1'
  is_active boolean not null default false,
  unique (academic_year_id, number)
);

create table class_sections (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete restrict,
  semester_id uuid not null references semesters(id) on delete restrict,
  name text not null,        -- e.g. 'MCA Year 1'
  section_code text not null, -- e.g. 'A'
  unique (program_id, semester_id, name, section_code)
);

create table subjects (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments(id) on delete restrict,
  code text unique not null,
  name text not null,
  credits int not null default 4
);

-- 4. Identity & Profiles (extends auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text unique not null,
  mobile text,
  role user_role not null default 'student',
  status account_status not null default 'pending',
  department_id uuid references departments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table student_profiles (
  user_id uuid primary key references profiles(id) on delete cascade,
  roll_no text unique not null,
  student_code text unique not null,
  program_id uuid references programs(id) on delete set null,
  admission_year int not null
);

create table faculty_profiles (
  user_id uuid primary key references profiles(id) on delete cascade,
  employee_id text unique not null,
  designation text not null default 'Assistant Professor'
);

-- 5. Teaching Assignments & Student Enrollments
create table teaching_assignments (
  id uuid primary key default gen_random_uuid(),
  faculty_id uuid not null references profiles(id) on delete restrict,
  subject_id uuid not null references subjects(id) on delete restrict,
  class_section_id uuid not null references class_sections(id) on delete restrict,
  semester_id uuid not null references semesters(id) on delete restrict,
  unique (faculty_id, subject_id, class_section_id, semester_id)
);

create table enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete restrict,
  class_section_id uuid not null references class_sections(id) on delete restrict,
  enrolled_at timestamptz not null default now(),
  is_active boolean not null default true,
  unique (student_id, class_section_id)
);

-- 6. Attendance
create table weekly_schedule_slots (
  id uuid primary key default gen_random_uuid(),
  teaching_assignment_id uuid not null references teaching_assignments(id) on delete cascade,
  day_of_week int not null check (day_of_week between 1 and 7), -- 1=Mon
  start_time time not null,
  end_time time not null,
  room text
);

create table attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  teaching_assignment_id uuid not null references teaching_assignments(id) on delete restrict,
  session_date date not null,
  slot_number int not null default 1,
  status session_status not null default 'conducted',
  recorded_by uuid not null references profiles(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teaching_assignment_id, session_date, slot_number)
);

create table attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references attendance_sessions(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete restrict,
  status attendance_status not null default 'present',
  unique (session_id, student_id)
);

-- 7. Google Drive File Metadata (files remain private in Google Drive)
create table drive_files (
  id uuid primary key default gen_random_uuid(),
  drive_file_id text unique not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  owner_user_id uuid not null references profiles(id),
  entity_type text not null check (entity_type in ('assignment_resource', 'submission_version')),
  entity_id uuid not null,
  created_at timestamptz not null default now()
);

-- 8. Assignments, Submissions & Evaluations
create table assignments (
  id uuid primary key default gen_random_uuid(),
  teaching_assignment_id uuid not null references teaching_assignments(id) on delete restrict,
  title text not null,
  instructions text not null default '',
  assigned_date date not null default current_date,
  due_at timestamptz not null,
  max_marks numeric(6,2) not null check (max_marks > 0),
  allowed_extensions text[] not null default array['pdf','docx','zip'],
  allow_resubmission boolean not null default true,
  state assignment_state not null default 'draft',
  attachment_file_id uuid references drive_files(id) on delete set null,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete restrict,
  status submission_status not null default 'not_submitted',
  resubmission_allowed_after_due boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

create table submission_versions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  version_no int not null check (version_no >= 1),
  drive_file_ref_id uuid not null references drive_files(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  is_late boolean not null default false,
  unique (submission_id, version_no)
);

create table evaluations (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid unique not null references submissions(id) on delete cascade,
  graded_version_id uuid not null references submission_versions(id) on delete restrict,
  marks_obtained numeric(6,2) check (marks_obtained >= 0),
  feedback text not null default '',
  status evaluation_status not null default 'not_evaluated',
  evaluated_by uuid references profiles(id),
  evaluated_at timestamptz,
  published_at timestamptz
);

-- Guardrail: Marks cannot exceed assignment.max_marks
create or replace function check_marks_within_max()
returns trigger as $$
declare
  v_max numeric(6,2);
begin
  if new.marks_obtained is not null then
    select a.max_marks into v_max
    from submissions s
    join assignments a on a.id = s.assignment_id
    where s.id = new.submission_id;

    if new.marks_obtained > v_max then
      raise exception 'marks_obtained (%) exceeds assignment max_marks (%)', new.marks_obtained, v_max;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_check_marks_within_max
before insert or update on evaluations
for each row execute function check_marks_within_max();

-- 9. Calendar, Notifications & Audit History
create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  event_type text not null check (event_type in ('holiday', 'college_event', 'department_event', 'class_note')),
  start_at timestamptz not null,
  end_at timestamptz not null,
  department_id uuid references departments(id) on delete cascade,
  class_section_id uuid references class_sections(id) on delete cascade,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  body text not null,
  link_url text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  changed_by uuid not null references profiles(id),
  reason text,
  created_at timestamptz not null default now()
);

create table backup_sync_logs (
  id uuid primary key default gen_random_uuid(),
  target text not null default 'google_sheets',
  records_exported int not null default 0,
  status text not null check (status in ('success', 'failed')),
  error_message text,
  triggered_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- 10. Auto-create pending student profile on Auth signup (prevents self-role escalation)
create or replace function handle_new_auth_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, role, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    'student',
    'pending'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_auth_user();
