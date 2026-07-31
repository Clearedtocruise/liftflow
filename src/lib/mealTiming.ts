/**
 * When a meal was actually eaten.
 *
 * The plan only ever knew when you *should* eat: `scheduled_date` is a calendar day and the clock
 * times on screen are computed for display. `consumed_at` was stamped with the moment you tapped
 * the button, so a breakfast logged at lunchtime recorded the wrong hour and nothing let you
 * correct it.
 */

/** How far the eaten time can be nudged in one tap. */
export const EATEN_STEP_MINUTES = 15;

/** Logging tomorrow's dinner, or one from last week, is a mistake rather than an intent. */
export const MAX_BACKDATE_HOURS = 36;

export function formatClockTime(iso: string | undefined, now = new Date()): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;

  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (isSameCalendarDay(date, now)) return time;

  const day = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${day} ${time}`;
}

export function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Clamps an eaten time to something believable: never in the future, never further back than
 * {@link MAX_BACKDATE_HOURS}.
 */
export function clampEatenAt(candidate: Date, now = new Date()): Date {
  if (Number.isNaN(candidate.getTime())) return now;
  if (candidate.getTime() > now.getTime()) return now;

  const earliest = now.getTime() - MAX_BACKDATE_HOURS * 60 * 60 * 1000;
  if (candidate.getTime() < earliest) return new Date(earliest);
  return candidate;
}

export function shiftEatenAt(iso: string, minutes: number, now = new Date()): string {
  const base = new Date(iso);
  const start = Number.isNaN(base.getTime()) ? now : base;
  return clampEatenAt(new Date(start.getTime() + minutes * 60 * 1000), now).toISOString();
}

/** True when the eaten time can still move later — used to disable the "+" control. */
export function canShiftLater(iso: string, minutes: number, now = new Date()): boolean {
  const base = new Date(iso);
  if (Number.isNaN(base.getTime())) return false;
  return base.getTime() + minutes * 60 * 1000 <= now.getTime() + 1000;
}

/**
 * Seeds the eaten time for a meal being marked as eaten.
 *
 * Defaults to now, which is right for "just ate it". A meal on an earlier day is stamped at the
 * end of that day instead, so back-filling yesterday's dinner does not land on today.
 */
export function defaultEatenAt(scheduledDate: string | undefined, now = new Date()): string {
  if (!scheduledDate) return now.toISOString();

  const parsed = new Date(`${scheduledDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return now.toISOString();
  if (isSameCalendarDay(parsed, now)) return now.toISOString();
  if (parsed.getTime() > now.getTime()) return now.toISOString();

  const endOfThatDay = new Date(parsed);
  endOfThatDay.setHours(19, 0, 0, 0);
  return clampEatenAt(endOfThatDay, now).toISOString();
}

/** "Ate 7:42 AM" for a logged meal, or the plan time when it has not been eaten yet. */
export function mealTimeLabel(
  params: { consumedAt?: string; scheduledTime?: string; eaten: boolean },
  now = new Date(),
): string {
  if (params.eaten) {
    const clock = formatClockTime(params.consumedAt, now);
    if (clock) return `Ate ${clock}`;
    return 'Eaten';
  }
  return params.scheduledTime ?? 'Scheduled';
}
