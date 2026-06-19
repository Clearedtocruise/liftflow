import { localDateString } from '@/lib/localDate';

/** Abandon ghost sessions left open from a prior day or an unusually long wall-clock span. */
const STALE_WORKOUT_MAX_AGE_MS = 8 * 60 * 60 * 1000;

export function isStaleWorkoutSession(startedAt: string, timeZone?: string | null): boolean {
  const startMs = new Date(startedAt).getTime();
  if (Number.isNaN(startMs)) return true;

  const startedDay = localDateString(new Date(startMs), timeZone);
  const today = localDateString(new Date(), timeZone);
  if (startedDay !== today) return true;

  return Date.now() - startMs > STALE_WORKOUT_MAX_AGE_MS;
}
