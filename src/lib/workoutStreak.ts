/**
 * Consecutive days trained, counted in the lifter's own calendar.
 *
 * `started_at` is a UTC instant, so slicing the first ten characters off it reads as the UTC day,
 * not the day the lifter was in the gym. West of Greenwich that is wrong for every evening
 * session: 5pm in Los Angeles is already tomorrow in UTC, so an afternoon workout landed on the
 * following day and left a hole where it had actually been trained. Holes end streaks.
 */

import { addCalendarDays, localDateString } from '@/lib/localDate';

export type WorkoutStreakOptions = {
  timeZone?: string | null;
  /** The lifter's today as YYYY-MM-DD. Defaults to now in `timeZone`. */
  today?: string;
};

export function computeWorkoutStreak(
  startedAt: readonly (string | null | undefined)[],
  options?: WorkoutStreakOptions,
): number {
  const timeZone = options?.timeZone;
  const today = options?.today ?? localDateString(new Date(), timeZone);

  const trainedDays = new Set<string>();
  for (const iso of startedAt) {
    const day = localDayFromIso(iso, timeZone);
    if (day) trainedDays.add(day);
  }
  if (trainedDays.size === 0) return 0;

  // Today is still in progress, so not having trained yet does not break anything. Only once
  // yesterday is also empty has the streak actually lapsed.
  const start = trainedDays.has(today) ? today : addCalendarDays(today, -1);

  let streak = 0;
  for (let day = start; trainedDays.has(day); day = addCalendarDays(day, -1)) {
    streak += 1;
  }
  return streak;
}

function localDayFromIso(iso: string | null | undefined, timeZone?: string | null): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return localDateString(parsed, timeZone);
}
