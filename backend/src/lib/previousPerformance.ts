/**
 * Previous exercise performance — "last time you did Bench Press: 185 lb × 8".
 *
 * Tied to (user, exercise), NOT to a program day. When an exercise reappears anywhere in the cycle
 * (or on a different day than before), the most recent completed set for that exercise is returned.
 * The DB read filters to completed sessions and orders by `logged_at`; the pure helpers below pick
 * and format the latest set and are unit-tested.
 */

import { normalizeExerciseName } from './exerciseCatalogDedup.js';
import { requireAdmin } from './supabase.js';

/** Normalized identity for matching an exercise name across sessions ("Pull-Up" == "pull up"). */
const exerciseNameKey = normalizeExerciseName;

const LB_PER_KG = 2.2046226218;

export type PerformanceSet = {
  weightKg: number | null;
  reps: number | null;
  loggedAt: string;
};

export type PreviousPerformance = {
  weightKg: number | null;
  reps: number | null;
  loggedAt: string;
};

/** Most recent set by `loggedAt` (defends against unordered input). */
export function pickLatestPerformance(sets: PerformanceSet[]): PreviousPerformance | null {
  if (!Array.isArray(sets) || sets.length === 0) return null;
  let latest: PerformanceSet | null = null;
  for (const set of sets) {
    if (!set?.loggedAt) continue;
    if (!latest || new Date(set.loggedAt).getTime() > new Date(latest.loggedAt).getTime()) {
      latest = set;
    }
  }
  if (!latest) return null;
  return { weightKg: latest.weightKg ?? null, reps: latest.reps ?? null, loggedAt: latest.loggedAt };
}

/** "185 lb × 8" / "8 reps" (bodyweight) / "—" when nothing is known. Weight rounded to whole lb. */
export function formatPreviousPerformance(
  perf: PreviousPerformance | null,
  unit: 'lb' | 'kg' = 'lb',
): string {
  if (!perf) return '—';
  const reps = perf.reps && perf.reps > 0 ? perf.reps : null;
  if (perf.weightKg && perf.weightKg > 0) {
    const weight = unit === 'kg' ? Math.round(perf.weightKg) : Math.round(perf.weightKg * LB_PER_KG);
    return reps ? `${weight} ${unit} × ${reps}` : `${weight} ${unit}`;
  }
  return reps ? `${reps} reps` : '—';
}

/**
 * Load the latest completed performance for each requested exercise name, keyed by normalized name.
 * Program-day-agnostic: joins through workout_exercises → exercises(name) and completed sessions.
 */
export async function loadPreviousPerformanceByName(
  userId: string,
  names: string[],
): Promise<Record<string, PreviousPerformance>> {
  const wanted = new Set(names.map(exerciseNameKey).filter(Boolean));
  if (wanted.size === 0) return {};

  const db = requireAdmin();
  const { data } = await db
    .from('workout_sets')
    .select(
      'weight, reps, logged_at, workout_exercises!inner(exercises(name), workout_sessions!inner(user_id, status))',
    )
    .eq('workout_exercises.workout_sessions.user_id', userId)
    .eq('workout_exercises.workout_sessions.status', 'completed')
    .order('logged_at', { ascending: false })
    .limit(500);

  const result: Record<string, PreviousPerformance> = {};
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const we = row.workout_exercises as { exercises?: { name?: string } } | null;
    const name = we?.exercises?.name;
    if (!name) continue;
    const key = exerciseNameKey(name);
    if (!wanted.has(key) || result[key]) continue; // rows are newest-first, so first hit is latest
    result[key] = {
      weightKg: typeof row.weight === 'number' ? row.weight : null,
      reps: typeof row.reps === 'number' ? row.reps : null,
      loggedAt: String(row.logged_at),
    };
  }
  return result;
}
