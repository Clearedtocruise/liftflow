/**
 * Turns logged sets into the one thing worth telling a lifter on the home screen.
 *
 * Kept separate from the query so the arithmetic is testable, and deliberately conservative: it
 * reports a gain only when there is a heavier set in the recent window *and* a comparable set in the
 * window before it. Comparing against "no data" would call every first-ever session a personal best.
 */

export type CoachSetSample = {
  exerciseName: string;
  /** Kilograms, as stored. Bodyweight sets have none and are skipped. */
  weightKg?: number;
  reps?: number;
  loggedAt: string;
};

export type StrengthGain = {
  exerciseName: string;
  /** Best working weight in the recent window, minus the best in the window before it. */
  deltaKg: number;
  recentBestKg: number;
  priorBestKg: number;
  /** Best weight per week, oldest to newest, for the sparkline. Gaps are weeks without the lift. */
  history: (number | undefined)[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * The largest strength gain across a pair of equal windows. `windowDays` is each window, so the
 * default compares the last 30 days against the 30 before that.
 */
export function findStrengthGain(
  samples: CoachSetSample[],
  now: Date = new Date(),
  windowDays = 30,
): StrengthGain | null {
  const end = now.getTime();
  const recentFrom = end - windowDays * DAY_MS;
  const priorFrom = end - windowDays * 2 * DAY_MS;

  const recentBest = new Map<string, { weight: number; label: string }>();
  const priorBest = new Map<string, number>();

  for (const sample of samples) {
    const weight = sample.weightKg;
    // A set with no weight or no reps is not evidence of a heavier lift.
    if (weight == null || !Number.isFinite(weight) || weight <= 0) continue;
    if (!sample.reps || sample.reps <= 0) continue;

    const at = new Date(sample.loggedAt).getTime();
    if (!Number.isFinite(at) || at < priorFrom || at > end) continue;

    const key = normalizeName(sample.exerciseName);
    if (!key) continue;

    if (at >= recentFrom) {
      const held = recentBest.get(key);
      if (!held || weight > held.weight) {
        recentBest.set(key, { weight, label: sample.exerciseName.trim() });
      }
    } else {
      priorBest.set(key, Math.max(priorBest.get(key) ?? 0, weight));
    }
  }

  let best: StrengthGain | null = null;
  for (const [key, recent] of recentBest) {
    const prior = priorBest.get(key);
    if (prior == null || prior <= 0) continue;
    const deltaKg = recent.weight - prior;
    if (deltaKg <= 0) continue;
    if (!best || deltaKg > best.deltaKg) {
      best = {
        exerciseName: recent.label,
        deltaKg,
        recentBestKg: recent.weight,
        priorBestKg: prior,
        history: weeklyBest(samples, key, now, 8),
      };
    }
  }
  return best;
}

/** Best weight per week for one exercise, oldest to newest. Weeks without the lift stay undefined. */
export function weeklyBest(
  samples: CoachSetSample[],
  exerciseKey: string,
  now: Date,
  weeks: number,
): (number | undefined)[] {
  const buckets: (number | undefined)[] = Array.from({ length: weeks }, () => undefined);
  const end = now.getTime();

  for (const sample of samples) {
    if (normalizeName(sample.exerciseName) !== exerciseKey) continue;
    const weight = sample.weightKg;
    if (weight == null || !Number.isFinite(weight) || weight <= 0) continue;

    const at = new Date(sample.loggedAt).getTime();
    if (!Number.isFinite(at) || at > end) continue;
    const weeksAgo = Math.floor((end - at) / (7 * DAY_MS));
    if (weeksAgo >= weeks) continue;

    const index = weeks - 1 - weeksAgo;
    buckets[index] = Math.max(buckets[index] ?? 0, weight);
  }
  return buckets;
}

/**
 * Phrases the gain for display. `Number` formatting is the caller's display unit, so this takes the
 * already-converted amount and its label rather than guessing kilograms versus pounds.
 */
export function describeStrengthGain(
  gain: StrengthGain,
  deltaInDisplayUnit: number,
  unitLabel: string,
): string {
  const rounded = Math.round(deltaInDisplayUnit);
  if (rounded < 1) return `You are matching your best on ${gain.exerciseName} again this month.`;

  const relative = gain.priorBestKg > 0 ? gain.deltaKg / gain.priorBestKg : 0;
  // The flourish is earned rather than automatic: "+2 lb, that's huge" reads as a machine talking.
  const flourish = relative >= 0.1 || rounded >= 20 ? " That's huge." : '';
  return `You added ${rounded} ${unitLabel} to your ${gain.exerciseName} this month.${flourish}`;
}
