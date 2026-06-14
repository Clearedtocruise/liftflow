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

export function weekStartDateString(today: string): string {
  const d = new Date(`${today}T12:00:00`);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return d.toISOString().slice(0, 10);
}
