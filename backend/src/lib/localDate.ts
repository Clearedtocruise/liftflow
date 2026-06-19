/** Local calendar helpers for server-side daily rollover (profile TZ → UTC fallback). */

export function resolveTimeZone(profileTimeZone?: string | null): string {
  const trimmed = profileTimeZone?.trim();
  if (trimmed) return trimmed;
  return 'UTC';
}

/** YYYY-MM-DD in the given IANA timezone. */
export function localDateString(date = new Date(), timeZone?: string | null): string {
  const tz = resolveTimeZone(timeZone);
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function addCalendarDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function weekStartFromDateString(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00.000Z`);
  const dow = d.getUTCDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + mondayOffset);
  return d.toISOString().slice(0, 10);
}

export function weekStartDateString(today: string): string {
  return weekStartFromDateString(today);
}
