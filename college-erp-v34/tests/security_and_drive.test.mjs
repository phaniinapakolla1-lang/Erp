import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Import the REAL parser (Node strips the TypeScript types) instead of testing a copy.
import { parseGoogleDriveLink } from '../src/lib/driveLink.ts';

test('Drive link parser accepts valid Google Drive & Docs URLs', () => {
  const pdf = parseGoogleDriveLink('https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view?usp=sharing');
  assert.equal(pdf.valid, true);
  assert.equal(pdf.fileId, '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');
  assert.equal(pdf.previewUrl, 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/preview');

  const doc = parseGoogleDriveLink('https://docs.google.com/document/d/abcDEF1234567890/edit');
  assert.equal(doc.valid, true);
  assert.equal(doc.fileId, 'abcDEF1234567890');
});

test('Drive link parser rejects http, non-Drive hosts, and folder URLs', () => {
  assert.equal(parseGoogleDriveLink('http://drive.google.com/file/d/1234567890/view').valid, false);
  assert.equal(parseGoogleDriveLink('https://evil.example.com/file/d/1234567890/view').valid, false);
  assert.equal(parseGoogleDriveLink('https://drive.google.com/drive/folders/1234567890').valid, false);
  assert.equal(parseGoogleDriveLink('not-a-url').valid, false);
});

test('Security audit: no hardcoded Supabase credentials or unapproved Sheets/proxy code in src/', () => {
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]
  );
  const srcFiles = walk('src');
  for (const file of srcFiles) {
    const content = fs.readFileSync(file, 'utf8');
    assert.equal(content.includes('sb_publishable_'), false, `Hardcoded key found in ${file}`);
    assert.equal(content.includes('rtfocxezjevrmopsddif'), false, `Hardcoded project URL found in ${file}`);
    assert.equal(content.includes('sheets-backup'), false, `Sheets backup reference found in ${file}`);
    assert.equal(content.includes('drive-proxy'), false, `Drive proxy reference found in ${file}`);
  }
});

test('Security audit: route guards, DEV-only demo mode, Drive confirmation, and RPCs are present', () => {
  const app = fs.readFileSync('src/App.tsx', 'utf8');
  assert.match(app, /RequireRole/);

  const auth = fs.readFileSync('src/contexts/AuthContext.tsx', 'utf8');
  assert.match(auth, /if \(!isDevMode\) return;/);

  const student = fs.readFileSync('src/pages/student/StudentPortal.tsx', 'utf8');
  assert.match(student, /I have reviewed the preview and this is my final assignment\./);
  assert.match(student, /rpc\('submit_assignment'/);

  const evalWs = fs.readFileSync('src/pages/faculty/EvaluationWorkspace.tsx', 'utf8');
  assert.match(evalWs, /rpcName = publish \? 'publish_evaluation' : 'save_evaluation'/);
  assert.match(evalWs, /You have unsaved evaluation changes/);
});

test('Data integrity: 010 migration, enrolled attendance, unified summary view, and dashboard calendar widgets', () => {
  const mig10 = fs.readFileSync('supabase/migrations/010_data_integrity_attendance_calendar.sql', 'utf8');
  assert.match(mig10, /v_student_attendance_summary/);
  assert.match(mig10, /chk_calendar_events_dates/);
  assert.match(mig10, /idx_sub_ver_unique_file/);
  assert.match(mig10, /idx_pending_correction_unique/);
  assert.match(mig10, /calendar_hod_dept_insert/);

  const stu = fs.readFileSync('src/pages/student/StudentPortal.tsx', 'utf8');
  assert.match(stu, /v_student_attendance_summary/);
  assert.match(stu, /submittingId/);

  const fac = fs.readFileSync('src/pages/faculty/FacultyDashboard.tsx', 'utf8');
  assert.match(fac, /from\('enrollments'\)/);

  for (const dash of [
    'src/pages/admin/AdminPortal.tsx',
    'src/pages/hod/HodPortal.tsx',
    'src/pages/faculty/FacultyDashboard.tsx',
    'src/pages/student/StudentPortal.tsx',
  ]) {
    assert.match(fs.readFileSync(dash, 'utf8'), /UpcomingCalendarWidget/);
  }

  const cal = fs.readFileSync('src/pages/shared/CalendarAndSettings.tsx', 'utf8');
  assert.match(cal, /viewMode === 'agenda'/);
  assert.match(cal, /viewMode === 'week'/);
  assert.match(cal, /endTime < startTime/);
});

test('Drive link parser: folderview and short IDs are rejected', () => {
  assert.equal(parseGoogleDriveLink('https://drive.google.com/folderview?id=1234567890abcdef').valid, false);
  assert.equal(parseGoogleDriveLink('https://drive.google.com/file/d/short/view').valid, false);
  assert.equal(parseGoogleDriveLink('https://drive.google.com/open?id=1234567890abcdef').valid, true);
});

test('Migration 011 closes the NULL-role bypass and adds request_resubmission', () => {
  const sql = fs.readFileSync(path.resolve('supabase/migrations/011_audit_fixes.sql'), 'utf8');
  assert.match(sql, /if v_role is null then raise exception 'Account is not approved'/);
  assert.match(sql, /v_role is null or v_role not in \('admin', 'hod'\)/);
  assert.match(sql, /function public\.request_resubmission/);
  assert.match(sql, /as restrictive for all to authenticated using \(public\.is_approved_user\(\)\)/);
  assert.match(sql, /drop policy if exists "submissions_student_write"/);
});

test('Migration 012 adds periods, roll-number policies and clash protection', () => {
  const sql = fs.readFileSync(path.resolve('supabase/migrations/012_profiles_periods_cleanup.sql'), 'utf8');
  assert.match(sql, /class_periods/);
  assert.match(sql, /create policy "student_profiles_read"/);
  assert.match(sql, /Timetable clash/);
});

test('Frontend reads VITE_ env vars and ships a matching .env.example', () => {
  const ex = fs.readFileSync(path.resolve('.env.example'), 'utf8');
  assert.match(ex, /VITE_SUPABASE_URL=/);
  assert.match(ex, /VITE_SUPABASE_ANON_KEY=/);
  const env = fs.existsSync(path.resolve('.env')) ? fs.readFileSync(path.resolve('.env'), 'utf8') : '';
  assert.ok(!/NEXT_PUBLIC_/.test(env), '.env must use VITE_ names');
});
