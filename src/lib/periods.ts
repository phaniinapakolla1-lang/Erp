import { supabase } from './supabase';

export interface Period { id: string; label: string; start: string; end: string }

export const DEFAULT_PERIODS: Period[] = [
  { id: '1', label: 'Period 1', start: '09:30', end: '10:30' },
  { id: '2', label: 'Period 2', start: '10:30', end: '11:30' },
  { id: '3', label: 'Period 3', start: '11:30', end: '12:30' },
  { id: '4', label: 'Period 4', start: '13:30', end: '14:30' },
  { id: '5', label: 'Period 5', start: '14:30', end: '15:30' },
  { id: '6', label: 'Period 6', start: '15:30', end: '16:30' },
];

/** Periods are stored in erp_settings.class_periods; period id == attendance slot_number. */
export async function fetchPeriods(): Promise<Period[]> {
  const { data, error } = await supabase.from('erp_settings').select('class_periods').eq('id', 1).maybeSingle();
  if (error || !Array.isArray(data?.class_periods) || data!.class_periods.length === 0) return DEFAULT_PERIODS;
  return (data!.class_periods as Period[]).map((p, i) => ({ ...p, id: String(i + 1) }));
}

export async function savePeriods(periods: Period[]): Promise<string | null> {
  const renumbered = periods.map((p, i) => ({ ...p, id: String(i + 1) }));
  const { error: rpcErr } = await supabase.rpc('admin_save_periods', { p_periods: renumbered });
  if (!rpcErr) return null;
  // Fallback if migration 026 is not yet applied
  const { error } = await supabase.from('erp_settings').update({ class_periods: renumbered }).eq('id', 1);
  return error ? error.message : null;
}
