-- Migration 008: Allow Faculty to add/delete their own class_note & deadline events on the shared calendar
-- Admin retains full control over all calendar events and holidays.

create policy "calendar_faculty_insert_own" on calendar_events
for insert to authenticated with check (
  current_user_role() = 'faculty'
  and event_type = 'class_note'
  and created_by = auth.uid()
);

create policy "calendar_faculty_delete_own" on calendar_events
for delete to authenticated using (
  current_user_role() = 'faculty'
  and event_type = 'class_note'
  and created_by = auth.uid()
);
