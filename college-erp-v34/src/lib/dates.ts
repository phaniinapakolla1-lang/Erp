/** Local-calendar helpers (toISOString() is UTC and gives the wrong day in IST early mornings). */
export function localISODate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Local date + time ("YYYY-MM-DD", "HH:MM") -> UTC ISO string for storage. */
export function localToUtcIso(date: string, time = '00:00'): string {
  return new Date(`${date}T${time}:00`).toISOString();
}
