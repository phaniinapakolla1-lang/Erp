import { createClient, SupabaseClient } from '@supabase/supabase-js';

const LS_URL = 'erp_supabase_url';
const LS_KEY = 'erp_supabase_anon_key';
const LS_BACKUP_URL = 'erp_backup_supabase_url';
const LS_BACKUP_KEY = 'erp_backup_supabase_key';
const LS_BACKUP_SHEET = 'erp_backup_sheet_id';

export function getSupabaseCredentials() {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  const localUrl = typeof window !== 'undefined' ? localStorage.getItem(LS_URL) || '' : '';
  const localKey = typeof window !== 'undefined' ? localStorage.getItem(LS_KEY) || '' : '';

  const url = localUrl || (envUrl.includes('your-project-id') ? '' : envUrl);
  const anonKey = localKey || (envKey.includes('your-supabase-anon-key') ? '' : envKey);
  return { url, anonKey };
}

export function getBackupConfig() {
  if (typeof window === 'undefined') return { backupUrl: '', backupKey: '', sheetId: '' };
  return {
    backupUrl: localStorage.getItem(LS_BACKUP_URL) || '',
    backupKey: localStorage.getItem(LS_BACKUP_KEY) || '',
    sheetId: localStorage.getItem(LS_BACKUP_SHEET) || '',
  };
}

export function saveBackupConfig(backupUrl: string, backupKey: string, sheetId: string) {
  localStorage.setItem(LS_BACKUP_URL, backupUrl.trim());
  localStorage.setItem(LS_BACKUP_KEY, backupKey.trim());
  localStorage.setItem(LS_BACKUP_SHEET, sheetId.trim());
}

const initial = getSupabaseCredentials();
export const isSupabaseConfigured = Boolean(initial.url && initial.anonKey);

export const supabase: SupabaseClient = createClient(
  initial.url || 'https://placeholder.supabase.co',
  initial.anonKey || 'placeholder-key'
);

export function saveSupabaseConfig(url: string, anonKey: string) {
  localStorage.setItem(LS_URL, url.trim());
  localStorage.setItem(LS_KEY, anonKey.trim());
  window.location.reload();
}

export function clearSupabaseConfig() {
  localStorage.removeItem(LS_URL);
  localStorage.removeItem(LS_KEY);
  window.location.reload();
}

export const REQUIRED_TABLES = [
  'profiles',
  'departments',
  'class_sections',
  'teaching_assignments',
  'attendance_sessions',
  'assignments',
  'submissions',
  'submission_versions',
  'evaluations',
  'calendar_events',
] as const;

export async function verifyDatabaseTables(url: string, anonKey: string): Promise<Record<string, boolean>> {
  const client = createClient(url.trim(), anonKey.trim());
  const results: Record<string, boolean> = {};
  await Promise.all(
    REQUIRED_TABLES.map(async (table) => {
      const { error } = await client.from(table).select('*', { count: 'exact', head: true });
      results[table] = !error || !error.message.includes('does not exist');
    })
  );
  return results;
}

export function downloadAdminBackupSnapshot() {
  const payload = {
    exportedAt: new Date().toISOString(),
    primaryConfigured: isSupabaseConfigured,
    backupConfig: getBackupConfig(),
    note: 'Admin snapshot of College ERP connection & configuration metadata.',
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `college-erp-admin-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function getDriveStreamUrl(driveFileId: string): string {
  const { url } = getSupabaseCredentials();
  return `${url}/functions/v1/drive-proxy?action=stream&drive_file_id=${encodeURIComponent(driveFileId)}`;
}
