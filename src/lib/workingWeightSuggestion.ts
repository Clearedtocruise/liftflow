import { localDateString } from '@/lib/localDate';
import type { ExerciseHistorySet } from '@/types/workoutExecution';

/**
 * Where the suggested weight for a loaded lift comes from when the last session was a light day.
 *
 * The suggestion was simply the newest set, so one empty-bar day of 45 lb × 20 replaced a 225 lb
 * squat until the lifter typed it back in. A session whose heaviest set is under half of what the
 * lifter recently worked at is read as a light day, and the suggestion comes from the last session
 * that was not, with its date shown. Every number here is one the lifter logged.
 */

/** A top set under this share of the recent best marks a session as a light day. */
const LIGHT_DAY_SHARE = 0.5;

type LoadedSet = ExerciseHistorySet & { weightKg: number };

export type LightDaySuggestion = {
  /** The first working set of the reference session — where that day started. */
  weightKg: number;
  reps?: number;
  lowWeightKg: number;
  highWeightKg: number;
  /** The reference session's local date, YYYY-MM-DD. */
  date: string;
};

function sessionsNewestFirst(history: ExerciseHistorySet[], timeZone?: string | null): LoadedSet[][] {
  const byDate = new Map<string, LoadedSet[]>();
  for (const set of history) {
    if (set.weightKg == null || set.weightKg <= 0) continue;
    const date = localDateString(new Date(set.loggedAt), timeZone);
    const sets = byDate.get(date) ?? [];
    sets.push(set as LoadedSet);
    byDate.set(date, sets);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([, sets]) => sets.sort((a, b) => a.loggedAt.localeCompare(b.loggedAt)));
}

const topWeight = (sets: LoadedSet[]) => Math.max(...sets.map((set) => set.weightKg));

/**
 * The session to suggest from when the newest one was a light day, or null when it was not (or
 * there is nothing heavier to compare it with), in which case the usual newest-set rule stands.
 * `history` is newest first, as `getRecentSetsForExercise` returns it.
 */
export function lightDayWorkingSuggestion(
  history: ExerciseHistorySet[],
  timeZone?: string | null,
): LightDaySuggestion | null {
  const sessions = sessionsNewestFirst(history, timeZone);
  if (sessions.length < 2) return null;
  const [latest, ...earlier] = sessions;
  const recentBest = Math.max(...earlier.map(topWeight));
  if (topWeight(latest) >= recentBest * LIGHT_DAY_SHARE) return null;

  const reference = earlier.find((sets) => topWeight(sets) >= recentBest * LIGHT_DAY_SHARE);
  if (!reference) return null;
  // Warm-ups ride along in the same session ("45 × 20, then 135 × 12"): start from the first set
  // that was actual work.
  const working = reference.filter((set) => set.weightKg >= topWeight(reference) * LIGHT_DAY_SHARE);
  const first = working[0];
  return {
    weightKg: first.weightKg,
    reps: first.reps,
    lowWeightKg: Math.min(...working.map((set) => set.weightKg)),
    highWeightKg: topWeight(reference),
    date: localDateString(new Date(first.loggedAt), timeZone),
  };
}
