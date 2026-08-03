/**
 * The compound lifts an athlete is asked about so the app can pick sensible starting weights.
 *
 * Mirrors backend/src/lib/strengthBaseline.ts. Without these the first working weight for a lift is
 * a fixed fraction of bodyweight, which is the same number whether you have trained for ten years
 * or ten days.
 */

export type BaselineLiftId = 'bench_press' | 'squat' | 'deadlift' | 'overhead_press';

export type BaselineEntry = {
  weightLbs: number;
  reps: number;
};

export type StrengthBaselines = Partial<Record<BaselineLiftId, BaselineEntry>>;

export const BASELINE_LIFTS: Array<{ id: BaselineLiftId; label: string; hint: string }> = [
  { id: 'squat', label: 'Squat', hint: 'Back squat, or the squat you train most' },
  { id: 'bench_press', label: 'Bench Press', hint: 'Flat barbell bench' },
  { id: 'deadlift', label: 'Deadlift', hint: 'Conventional or sumo' },
  { id: 'overhead_press', label: 'Overhead Press', hint: 'Standing barbell press' },
];

export const MIN_BASELINE_WEIGHT_LBS = 5;
export const MAX_BASELINE_WEIGHT_LBS = 1200;
export const MAX_BASELINE_REPS = 20;

/** Rejects entries that cannot be real, so a typo never becomes a training load. */
export function isPlausibleBaseline(entry: Partial<BaselineEntry> | null | undefined): boolean {
  if (!entry) return false;
  const { weightLbs, reps } = entry;
  if (weightLbs == null || reps == null) return false;
  if (!Number.isFinite(weightLbs) || !Number.isFinite(reps)) return false;
  if (weightLbs < MIN_BASELINE_WEIGHT_LBS || weightLbs > MAX_BASELINE_WEIGHT_LBS) return false;
  return reps >= 1 && reps <= MAX_BASELINE_REPS;
}

/**
 * Epley, matching the backend so a reported set and a logged set are measured the same way.
 * Reps are capped because the formula drifts badly on long sets.
 */
export function estimateOneRepMaxLbs(weightLbs: number, reps: number): number {
  if (!Number.isFinite(weightLbs) || !Number.isFinite(reps)) return 0;
  if (weightLbs <= 0 || reps <= 0) return 0;
  if (reps === 1) return Math.round(weightLbs);
  return Math.round(weightLbs * (1 + Math.min(reps, 12) / 30));
}

/** Drops blank or implausible rows so only usable entries are saved. */
export function collectBaselines(
  draft: Partial<Record<BaselineLiftId, { weight: string; reps: string }>>,
): StrengthBaselines {
  const out: StrengthBaselines = {};
  for (const lift of BASELINE_LIFTS) {
    const row = draft[lift.id];
    if (!row) continue;
    const entry = { weightLbs: Number(row.weight), reps: Number(row.reps) };
    if (isPlausibleBaseline(entry)) out[lift.id] = entry;
  }
  return out;
}
