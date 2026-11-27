-- 004 intentionally left as a no-op.
-- It previously hardcoded a personal email for automatic admin promotion; that was removed
-- (and the trigger was replaced in 006). Promote your first admin manually:
--   update public.profiles set role = 'admin', status = 'approved' where email = '<your-admin-email>';
select 1;
