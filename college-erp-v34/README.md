# College ERP — Academic Operations Portal

A lightweight, single-college ERP built with **React 18 + TypeScript + Vite** and **Supabase** (PostgreSQL + Auth + RLS), using **Google Drive public-view links** for student assignment submissions and faculty review.

## Architecture

- **Frontend:** React 18, TypeScript, Vite, React Router, Lucide React.
- **Database & Auth:** Supabase PostgreSQL + Supabase Auth + PostgreSQL Row-Level Security (RLS).
- **Document Storage:** Students upload assignments to their own Google Drive (`Anyone with the link – Viewer`) and submit the file-view URL after preview confirmation. No OAuth tokens, Drive API proxies, or Google Sheets integrations are used.

## Database Migrations

Run these in **Supabase Dashboard → SQL Editor** in order:
1. `001_schema.sql` through `010_*.sql` (note: `004_seed_admin.sql` is now a no-op; there is no `007`)
2. `011_audit_fixes.sql` — approval enforced in RLS (restrictive policies), fixed NULL-role bypass in the evaluation/correction RPCs, real submission deadlines (`assignments.allow_late_submission`), `request_resubmission` RPC, attendance view/audit/edit-window fixes, scoped timetable and calendar visibility.

3. `012_profiles_periods_cleanup.sql` — roll numbers (policies on `student_profiles`), DB-backed class periods, timetable clash protection, removal of unused Drive-upload/backup tables.
4. `013_student_roll_and_directory_view.sql` — roll number index and `v_student_directory` view.
5. `014_profile_details_and_roll_fix.sql` — personal profile fields (`gender`, `dob`, `address`, `bio`, `avatar_icon`), `update_own_profile`, and `admin_update_user_academic`.
6. `015_admin_crud_and_student_dashboard.sql` — Admin user CRUD RPCs (`admin_finalize_created_user`, `admin_update_user`, `admin_delete_user`).
7. `016_srs_resources_announcements_reports.sql` — `learning_resources`, `announcements`, assignment instructions/reference links, and `admin_upsert_faculty_profile`.
8. `017_p0_security_and_hod_audit_scope.sql` — department-scoped `audit_logs` RLS for HOD.

Promote your first admin manually after signing up:
```sql
update public.profiles set role = 'admin', status = 'approved' where email = 'you@example.com';
```

## Environment Setup

1. Copy `.env.example` to `.env` and fill in your Supabase project values:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```
2. Install dependencies and run locally:
   ```bash
   npm install
   npm run dev
   ```
3. Run security & Drive link tests:
   ```bash
   npm test
   ```

## Quick start (Windows / Mac / Linux)

1. Install Node.js 18+.
2. Run `start.bat` (Windows) or `./start.sh` (Mac/Linux) — it installs dependencies and starts the dev server.
3. Open http://localhost:5173.

`.env` is pre-filled with the Supabase project from your original upload (variables renamed to `VITE_*`). Apply migrations 001–017 in the Supabase SQL editor first, and in Supabase Auth settings add your site URL (and `http://localhost:5173`) to the allowed redirect URLs so password-reset links work.

## Known limitations
- Drive submissions are links: the app cannot verify the file is shared correctly or unchanged after the deadline (needs a Drive API / edge-function integration).
- Roll numbers are entered by Admin (Users page); until set, a sorted serial number is shown.
