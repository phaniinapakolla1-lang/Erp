-- Migration 005: Bulk CSV Onboarding Allowlist & Attendance Correction Requests

create table if not exists onboarding_allowlist (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text not null,
  role user_role not null default 'student',
  roll_no text,
  department_code text,
  imported_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists attendance_correction_requests (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references attendance_sessions(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  requested_status attendance_status not null,
  reason text not null,
  requested_by uuid not null references profiles(id),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table onboarding_allowlist enable row level security;
alter table attendance_correction_requests enable row level security;

create policy "allowlist_admin_only" on onboarding_allowlist
for all to authenticated using (current_user_role() = 'admin');

create policy "corrections_read" on attendance_correction_requests
for select to authenticated using (
  requested_by = auth.uid() or current_user_role() in ('admin', 'hod')
);

create policy "corrections_insert_faculty" on attendance_correction_requests
for insert to authenticated with check (requested_by = auth.uid());

create policy "corrections_review_admin_hod" on attendance_correction_requests
for update to authenticated using (current_user_role() in ('admin', 'hod'));
