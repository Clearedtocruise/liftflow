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

function zonedOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second'),
  );
  return (asUtc - instant.getTime()) / 60_000;
}

/** The UTC instant at which the given local calendar day begins in `timeZone`. */
export function localDayStartUtc(dateStr: string, timeZone?: string | null): Date {
  const tz = resolveTimeZone(timeZone);
  const naive = Date.parse(`${dateStr}T00:00:00.000Z`);
  try {
    // One refinement pass so a DST transition inside the day resolves to the correct offset.
    const firstGuess = naive - zonedOffsetMinutes(new Date(naive), tz) * 60_000;
    return new Date(naive - zonedOffsetMinutes(new Date(firstGuess), tz) * 60_000);
  } catch {
    return new Date(naive);
  }
}

/**
 * Half-open [start, end) UTC bounds for a local calendar day. Timestamptz columns must be
 * filtered on these rather than on `date + 'T00:00:00'` string bounds, which are both
 * timezone-naive and drop the final second of the day.
 */
export function localDayRangeUtc(
  dateStr: string,
  timeZone?: string | null,
): { startIso: string; endIso: string } {
  return {
    startIso: localDayStartUtc(dateStr, timeZone).toISOString(),
    endIso: localDayStartUtc(addCalendarDays(dateStr, 1), timeZone).toISOString(),
  };
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
