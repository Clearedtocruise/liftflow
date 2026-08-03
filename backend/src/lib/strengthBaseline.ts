/**
 * Starting loads derived from what the athlete can actually lift.
 *
 * With no history, the planner guessed a working weight as a fixed fraction of bodyweight — squat
 * at 65%, bench at 45%, everything else at 20%. That is the same person's number whether they have
 * trained for a decade or a week, and it is what surfaced absurd loads before the isolation caps
 * went in. Asking for two or three lifts at onboarding costs one screen and replaces the guess with
 * an estimate anchored to real performance.
 *
 * Baselines are stored as the set the athlete reported (weight and reps), not as a max, so the
 * estimate can be recomputed if the formula changes and nothing claims they tested a true single.
 */

import { resolveMovementFamily, type MovementFamily } from './movementFamily.js';

/** The compound lifts an athlete is asked about. Everything else is derived from these. */
export type BaselineLift = 'bench_press' | 'squat' | 'deadlift' | 'overhead_press';

export const BASELINE_LIFTS: BaselineLift[] = ['bench_press', 'squat', 'deadlift', 'overhead_press'];

export type BaselineEntry = {
  weightLbs: number;
  reps: number;
};

export type StrengthBaselines = Partial<Record<BaselineLift, BaselineEntry>>;

/**
 * Epley. Matches `estimateOneRepMax` in programProgression so a baseline and a logged set are
 * measured the same way.
 *
 * Above about 12 reps the formula drifts badly, so reported sets are capped rather than trusted —
 * "225 for 30" should not imply a 450 lb max.
 */
const MAX_TRUSTED_REPS = 12;

export function estimateOneRepMaxLbs(weightLbs: number, reps: number): number {
  if (!Number.isFinite(weightLbs) || !Number.isFinite(reps)) return 0;
  if (weightLbs <= 0 || reps <= 0) return 0;
  if (reps === 1) return Math.round(weightLbs * 10) / 10;
  const trusted = Math.min(reps, MAX_TRUSTED_REPS);
  return Math.round(weightLbs * (1 + trusted / 30) * 10) / 10;
}

/** Inverse Epley: the load that should be achievable for `reps` given an estimated max. */
export function workingWeightLbs(estimatedMaxLbs: number, reps: number): number {
  if (estimatedMaxLbs <= 0 || reps <= 0) return 0;
  const trusted = Math.min(reps, MAX_TRUSTED_REPS);
  return estimatedMaxLbs / (1 + trusted / 30);
}

/**
 * How a movement relates to the compound lift it is anchored to.
 *
 * These are conservative on purpose: starting light and adding weight is a session's inconvenience,
 * while starting heavy is an injury. Isolation work stays well below its anchor and is capped again
 * downstream.
 */
const FAMILY_ANCHORS: Partial<Record<MovementFamily, { lift: BaselineLift; ratio: number }>> = {
  horizontal_press: { lift: 'bench_press', ratio: 0.95 },
  chest_isolation: { lift: 'bench_press', ratio: 0.25 },
  triceps_isolation: { lift: 'bench_press', ratio: 0.2 },
  vertical_press: { lift: 'overhead_press', ratio: 0.95 },
  lateral_raise: { lift: 'overhead_press', ratio: 0.15 },

  horizontal_pull: { lift: 'bench_press', ratio: 0.8 },
  vertical_pull: { lift: 'bench_press', ratio: 0.75 },
  biceps_isolation: { lift: 'bench_press', ratio: 0.22 },
  rear_delt: { lift: 'overhead_press', ratio: 0.15 },

  squat_pattern: { lift: 'squat', ratio: 0.95 },
  lunge_pattern: { lift: 'squat', ratio: 0.45 },
  quad_isolation: { lift: 'squat', ratio: 0.35 },

  hinge_pattern: { lift: 'deadlift', ratio: 0.9 },
  hamstring_isolation: { lift: 'deadlift', ratio: 0.3 },
  glute_isolation: { lift: 'deadlift', ratio: 0.3 },
  calf_isolation: { lift: 'squat', ratio: 0.4 },
};

/**
 * Variants that train the same pattern at a very different load.
 *
 * A family ratio alone prescribed a Romanian deadlift like a conventional pull and an incline press
 * like a flat bench. The first match applies, so the more specific pattern is listed first.
 */
const VARIANT_MODIFIERS: Array<{ pattern: RegExp; ratio: number }> = [
  { pattern: /\bromanian\b|\brdl\b|\bstiff[\s-]?leg\b|\bgood\s*morning\b|\bhyper\b/i, ratio: 0.65 },
  { pattern: /\bdeficit\b/i, ratio: 0.85 },
  { pattern: /\bincline\b/i, ratio: 0.8 },
  { pattern: /\bclose[\s-]?grip\b|\bpause\b|\btempo\b/i, ratio: 0.85 },
  { pattern: /\bfront\s+squat\b|\bgoblet\b|\bhack\b|\bsissy\b/i, ratio: 0.7 },
  { pattern: /\boverhead\s+squat\b/i, ratio: 0.45 },
  { pattern: /\bsingle[\s-]?(leg|arm)\b|\bone[\s-]?(leg|arm)\b|\bbulgarian\b/i, ratio: 0.5 },
];

function variantModifier(name: string): number {
  for (const rule of VARIANT_MODIFIERS) {
    if (rule.pattern.test(name)) return rule.ratio;
  }
  return 1;
}

/** When the anchor lift was not reported, estimate it from one that was. */
const LIFT_RELATIONSHIPS: Record<BaselineLift, Partial<Record<BaselineLift, number>>> = {
  bench_press: { squat: 0.75, deadlift: 0.62, overhead_press: 1.5 },
  squat: { bench_press: 1.3, deadlift: 0.82, overhead_press: 2.0 },
  deadlift: { squat: 1.2, bench_press: 1.6, overhead_press: 2.4 },
  overhead_press: { bench_press: 0.66, squat: 0.5, deadlift: 0.42 },
};

/** The reported max for a lift, falling back to whichever related lift was reported. */
export function estimatedMaxForLift(
  baselines: StrengthBaselines | null | undefined,
  lift: BaselineLift,
): number | undefined {
  if (!baselines) return undefined;

  const direct = baselines[lift];
  if (direct) {
    const max = estimateOneRepMaxLbs(direct.weightLbs, direct.reps);
    if (max > 0) return max;
  }

  for (const [related, ratio] of Object.entries(LIFT_RELATIONSHIPS[lift]) as Array<[BaselineLift, number]>) {
    const entry = baselines[related];
    if (!entry) continue;
    const relatedMax = estimateOneRepMaxLbs(entry.weightLbs, entry.reps);
    if (relatedMax > 0) return Math.round(relatedMax * ratio * 10) / 10;
  }

  return undefined;
}

/**
 * A starting load for an exercise the athlete has never logged, from their reported baselines.
 *
 * Returns undefined when nothing was reported or the movement has no sensible anchor, so the caller
 * keeps its existing bodyweight-fraction estimate rather than inventing one.
 */
export function seedWeightLbsFromBaselines(input: {
  exerciseName?: string | null;
  exerciseSlug?: string | null;
  baselines: StrengthBaselines | null | undefined;
  targetReps: number;
}): number | undefined {
  const { baselines, targetReps } = input;
  if (!baselines || Object.keys(baselines).length === 0) return undefined;

  const family = resolveMovementFamily({ name: input.exerciseName, slug: input.exerciseSlug });
  if (!family) return undefined;

  const anchor = FAMILY_ANCHORS[family];
  if (!anchor) return undefined;

  const anchorMax = estimatedMaxForLift(baselines, anchor.lift);
  if (!anchorMax || anchorMax <= 0) return undefined;

  const variant = variantModifier(`${input.exerciseName ?? ''} ${input.exerciseSlug ?? ''}`);
  const working = workingWeightLbs(anchorMax * anchor.ratio * variant, targetReps);
  if (!Number.isFinite(working) || working <= 0) return undefined;

  // Gyms are stocked in 5 lb steps, and rounding down keeps the first session honest.
  const rounded = Math.floor(working / 5) * 5;
  return rounded >= 5 ? rounded : 5;
}

/** Rejects entries that cannot be real, so a typo does not become a training load. */
export function isPlausibleBaseline(entry: BaselineEntry | null | undefined): boolean {
  if (!entry) return false;
  const { weightLbs, reps } = entry;
  if (!Number.isFinite(weightLbs) || !Number.isFinite(reps)) return false;
  if (weightLbs < 5 || weightLbs > 1200) return false;
  return reps >= 1 && reps <= 20;
}

export function sanitizeBaselines(raw: unknown): StrengthBaselines {
  if (!raw || typeof raw !== 'object') return {};
  const out: StrengthBaselines = {};
  for (const lift of BASELINE_LIFTS) {
    const entry = (raw as Record<string, unknown>)[lift];
    if (!entry || typeof entry !== 'object') continue;
    const candidate = {
      weightLbs: Number((entry as Record<string, unknown>).weightLbs),
      reps: Number((entry as Record<string, unknown>).reps),
    };
    if (isPlausibleBaseline(candidate)) out[lift] = candidate;
  }
  return out;
}
