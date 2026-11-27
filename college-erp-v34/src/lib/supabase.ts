import { createClient, SupabaseClient } from '@supabase/supabase-js';

const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const isDevMode = import.meta.env.DEV;

export const isSupabaseConfigured = Boolean(
  envUrl &&
  envKey &&
  !envUrl.includes('your-project-id') &&
  !envKey.includes('your-supabase-anon-key')
);

export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(envUrl, envKey)
  : createClient('https://unconfigured.invalid', 'unconfigured-key');

/** Non-persisting client used by Admin when creating a new Auth user so the Admin's own session is never overwritten. */
export const supabaseSignUpOnly: SupabaseClient = isSupabaseConfigured
  ? createClient(envUrl, envKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  : createClient('https://unconfigured.invalid', 'unconfigured-key');

export function exportToCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  // Neutralise spreadsheet formula injection (=, +, -, @, tab, CR) and escape quotes.
  const escape = (v: string | number) => {
    let str = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(str) && typeof v !== 'number') str = `'${str}`;
    return `"${str.replace(/"/g, '""')}"`;
  };
  const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\r\n');
  // BOM so Excel reads UTF-8 correctly.
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const isDemoProfile = (profile: { id: string } | null | undefined): boolean =>
  isDevMode && (!isSupabaseConfigured || !profile || profile.id.startsWith('demo-'));
