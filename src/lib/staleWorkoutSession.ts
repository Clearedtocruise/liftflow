/** Abandon ghost sessions left open for more than a week. */
const STALE_WORKOUT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function isStaleWorkoutSession(startedAt: string, _timeZone?: string | null): boolean {
  const startMs = new Date(startedAt).getTime();
  if (Number.isNaN(startMs)) return true;
  return Date.now() - startMs > STALE_WORKOUT_MAX_AGE_MS;
}
