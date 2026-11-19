# College ERP — Academic Operations Portal

A lightweight, single-college ERP built with **React + TypeScript + Vite** and **Supabase** (PostgreSQL + Auth + RLS + Edge Functions), using **Google Drive** (via authenticated Edge Function proxy) for private assignment/submission files and **Google Sheets** for one-way student directory backups.

## Project Structure

- `supabase/migrations/001_schema.sql` — 18-table PostgreSQL schema with `check_marks_within_max` trigger and `handle_new_auth_user` pending-approval gate.
- `supabase/migrations/002_rls.sql` — Row-Level Security policies scoping Admin, HOD (department), Faculty (assigned classes), and Student (self).
- `supabase/functions/drive-proxy/index.ts` — Authenticated upload & streaming proxy for Google Drive (avoids public links and 0 GB service-account quota errors).
- `supabase/functions/sheets-backup/index.ts` — One-way student directory export from Supabase to Google Sheets.
- `src/` — Unified React application with role-scoped portals (`Admin`, `Faculty` including `F07` Split-Frame Evaluation Workspace, `Student`, `HOD`), light/dark mode, and local preview fallback when `.env` is unset.

## Quick Start

1. **Install dependencies & preview locally:**
   ```bash
   npm install
   npm run dev
   ```
   Without `.env` configured, the login screen provides instant 1-click role preview buttons (`FACULTY`, `STUDENT`, `ADMIN`, `HOD`) so you can inspect every portal and the F07 Split-Frame Evaluation Workspace immediately.

2. **Connect Supabase:**
   - Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
   - Run `supabase/migrations/001_schema.sql` and `002_rls.sql` in the Supabase SQL Editor.

3. **Deploy Edge Functions (Google Drive & Google Sheets):**
   ```bash
   supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... GOOGLE_REFRESH_TOKEN=... GOOGLE_DRIVE_ROOT_FOLDER_ID=... GOOGLE_BACKUP_SHEET_ID=...
   supabase functions deploy drive-proxy
   supabase functions deploy sheets-backup
   ```
