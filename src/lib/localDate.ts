/**
 * Local calendar/time helpers — avoid UTC day shift from toISOString().slice(0, 10).
 */

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  } catch {
    return 'UTC';
  }
}

export function resolveTimeZone(profileTimeZone?: string | null): string {
  const trimmed = profileTimeZone?.trim();
  if (trimmed) return trimmed;
  return deviceTimeZone();
}

/** YYYY-MM-DD in the given IANA timezone (defaults to device). */
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
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

export function localTimeString(date = new Date(), timeZone?: string | null): string {
  const tz = resolveTimeZone(timeZone);
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    const h = date.getHours();
    const m = date.getMinutes();
    const suffix = h >= 12 ? 'PM' : 'AM';
    const displayHour = h % 12 === 0 ? 12 : h % 12;
    return `${displayHour}:${String(m).padStart(2, '0')} ${suffix}`;
  }
}

export function localMinutesSinceMidnight(date = new Date(), timeZone?: string | null): number {
  const tz = resolveTimeZone(timeZone);
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
    return hour * 60 + minute;
  } catch {
    return date.getHours() * 60 + date.getMinutes();
  }
}

/** Parse "10:30 AM" / "5:00 PM" to minutes since midnight. */
export function parseScheduledTimeToMinutes(timeLabel: string): number | null {
  const match = timeLabel.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const suffix = match[3].toUpperCase();
  if (suffix === 'PM' && hour !== 12) hour += 12;
  if (suffix === 'AM' && hour === 12) hour = 0;
  return hour * 60 + minute;
}

export function normalizeCalendarDate(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length >= 10 ? trimmed.slice(0, 10) : trimmed;
}

export function isSameCalendarDate(a?: string | null, b?: string | null): boolean {
  const left = normalizeCalendarDate(a);
  const right = normalizeCalendarDate(b);
  return left != null && right != null && left === right;
}

/** Add days to YYYY-MM-DD using UTC noon to avoid DST edge cases. */
export function addCalendarDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Monday-start week containing the given YYYY-MM-DD. */
export function weekStartFromDateString(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00.000Z`);
  const dow = d.getUTCDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + mondayOffset);
  return d.toISOString().slice(0, 10);
}
  if (!time?.trim()) return null;
  const raw = time.trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return raw;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${suffix}`;
}

export type TimezoneDebugInfo = {
  deviceTimeZone: string;
  profileTimeZone: string | null;
  effectiveTimeZone: string;
  currentLocalTime: string;
  localDate: string;
};

export function buildTimezoneDebugInfo(profileTimeZone?: string | null): TimezoneDebugInfo {
  const now = new Date();
  const effective = resolveTimeZone(profileTimeZone);
  return {
    deviceTimeZone: deviceTimeZone(),
    profileTimeZone: profileTimeZone ?? null,
    effectiveTimeZone: effective,
    currentLocalTime: localTimeString(now, effective),
    localDate: localDateString(now, effective),
  };
}

if (__DEV__) {
  // eslint-disable-next-line no-console
  console.info('[localDate] device TZ:', deviceTimeZone());
}
