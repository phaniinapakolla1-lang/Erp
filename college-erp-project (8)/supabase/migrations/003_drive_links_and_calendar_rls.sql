-- Updated Submission Versions & Calendar RLS notes:
-- 1. Students upload to their own Google Drive and paste the shareable link into the ERP.
--    `submission_versions` stores `drive_url` + extracted `drive_file_id` in Supabase.
-- 2. Only Admin can create/update/delete `calendar_events`; all approved roles can read.

-- Calendar RLS (Admin-only write, all approved users read)
drop policy if exists "calendar_read_approved" on calendar_events;
drop policy if exists "calendar_admin_write" on calendar_events;

create policy "calendar_read_approved" on calendar_events
for select to authenticated using (is_approved_user());

create policy "calendar_admin_write" on calendar_events
for all to authenticated
using (current_user_role() = 'admin')
with check (current_user_role() = 'admin');

-- Allow storing student-pasted Google Drive URLs directly on submission_versions
alter table submission_versions
  alter column drive_file_ref_id drop not null,
  add column if not exists drive_url text not null default '',
  add column if not exists drive_file_id text;
