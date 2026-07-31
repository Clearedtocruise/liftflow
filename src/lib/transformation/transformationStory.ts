import type { BodyCompositionRecord } from '@/types';
import type { BodyCompositionSnapshot, TransformationProjection } from '@/types/transformation';

export const BODY_FAT_MILESTONES = [20, 18, 15, 12, 10] as const;

export type ScheduleStatus = 'ahead' | 'on_track' | 'behind' | 'at_goal' | 'unknown';

export type BodyFatMilestone = {
  bodyFatPct: number;
  estimatedDate?: string;
  reached: boolean;
};

export type TransformationStory = {
  currentWeightKg: number;
  currentBodyFatPct: number;
  goalWeightKg: number;
  goalBodyFatPct: number;
  daysRemaining?: number;
  estimatedCompletionDate?: string;
  progressPercent: number;
  startWeightKg?: number;
  startBodyFatPct?: number;
  requiredFatLossKg: number;
  currentPaceKgPerWeek?: number;
  scheduleStatus: ScheduleStatus;
  scheduleLabel: string;
  weeksAhead?: number;
  coachInsights: string[];
  milestones: BodyFatMilestone[];
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function normalizeBodyCompositionSnapshot(
  snapshot: Partial<BodyCompositionSnapshot> | null | undefined,
): BodyCompositionSnapshot | null {
  if (!snapshot?.weightKg || !Number.isFinite(snapshot.weightKg)) return null;
  if (snapshot.bodyFatPct == null || !Number.isFinite(snapshot.bodyFatPct)) return null;

  const fatMassKg = Number.isFinite(snapshot.fatMassKg)
    ? snapshot.fatMassKg!
    : round1(snapshot.weightKg * (snapshot.bodyFatPct / 100));
  const leanMassKg = Number.isFinite(snapshot.leanMassKg)
    ? snapshot.leanMassKg!
    : round1(snapshot.weightKg - fatMassKg);

  if (!Number.isFinite(fatMassKg) || !Number.isFinite(leanMassKg)) return null;

  return {
    weightKg: round1(snapshot.weightKg),
    bodyFatPct: round1(snapshot.bodyFatPct),
    fatMassKg,
    leanMassKg,
  };
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDisplayDate(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * The projection row freezes a snapshot at the moment it was run, so a measurement logged
 * afterwards left the hero showing an old weight and body fat. Prefer the newest measurement
 * whenever it post-dates the stored run.
 */
export function resolveCurrentSnapshot(
  projectionCurrent: BodyCompositionSnapshot,
  measurements: BodyCompositionRecord[],
  projectionCreatedAt?: string,
): BodyCompositionSnapshot {
  // Weight-only weigh-ins count: body fat is carried forward from the last reading that had one.
  const series = buildFatMassSeries(measurements);
  const latest = series[series.length - 1];
  if (!latest) return projectionCurrent;

  if (projectionCreatedAt) {
    const runTime = new Date(projectionCreatedAt).getTime();
    if (Number.isFinite(runTime) && latest.timeMs <= runTime) {
      return projectionCurrent;
    }
  }

  return (
    normalizeBodyCompositionSnapshot({
      weightKg: latest.weightKg,
      bodyFatPct: latest.bodyFatPct,
      fatMassKg: latest.fatMassKg,
    }) ?? projectionCurrent
  );
}

/** Goal weight holds lean mass constant — mirrors the backend's projectToTargetBodyFat. */
export function projectGoalSnapshot(
  current: BodyCompositionSnapshot,
  targetBodyFatPct: number,
): BodyCompositionSnapshot {
  const weightKg = round1(current.leanMassKg / (1 - targetBodyFatPct / 100));
  const fatMassKg = round1(weightKg * (targetBodyFatPct / 100));
  return {
    weightKg,
    bodyFatPct: round1(targetBodyFatPct),
    fatMassKg,
    leanMassKg: round1(weightKg - fatMassKg),
  };
}

export function resolveStartSnapshot(
  measurements: BodyCompositionRecord[],
  current: BodyCompositionSnapshot,
): BodyCompositionSnapshot | null {
  const oldest = buildFatMassSeries(measurements)[0];
  if (!oldest) return null;

  return {
    weightKg: round1(oldest.weightKg),
    bodyFatPct: round1(oldest.bodyFatPct),
    leanMassKg: round1(oldest.weightKg - oldest.fatMassKg),
    fatMassKg: round1(oldest.fatMassKg),
  };
}

export function computeProgressPercent(
  startBf: number,
  currentBf: number,
  goalBf: number,
): number {
  if (goalBf >= startBf - 0.1) return currentBf <= goalBf + 0.1 ? 100 : 0;
  const totalDelta = startBf - goalBf;
  const achieved = startBf - currentBf;
  return Math.round(Math.min(100, Math.max(0, (achieved / totalDelta) * 100)));
}

export function estimateMilestoneDate(
  currentBf: number,
  milestoneBf: number,
  paceKgPerWeek: number | undefined,
  currentWeightKg: number,
  now = new Date(),
): string | undefined {
  if (currentBf <= milestoneBf + 0.1) return undefined;
  if (!paceKgPerWeek || paceKgPerWeek <= 0) return undefined;

  // Losing fat lowers body weight, so holding weight constant understated the fat to lose and
  // dated the final milestone before the completion date it is supposed to match.
  const currentFatKg = currentWeightKg * (currentBf / 100);
  const leanMassKg = currentWeightKg - currentFatKg;
  const targetWeightKg = leanMassKg / (1 - milestoneBf / 100);
  const targetFatKg = targetWeightKg * (milestoneBf / 100);
  const fatToLose = Math.max(0, currentFatKg - targetFatKg);
  const weeks = fatToLose / paceKgPerWeek;
  if (!Number.isFinite(weeks) || weeks <= 0) return undefined;
  return formatIsoDate(addDays(now, Math.round(weeks * 7)));
}

/**
 * Share of a weight change treated as fat when only the scale was logged.
 *
 * Holding lean mass constant would credit every pound to fat, which flatters the timeline. Some
 * of a loss is water and lean tissue, so weight-only days are discounted.
 */
export const FAT_SHARE_OF_WEIGHT_CHANGE = 0.75;

/** Recent weeks only — an early water-weight drop should not set the pace for months. */
export const PACE_WINDOW_DAYS = 42;

/** Fat loss slows as you lean out, so the trailing rate is haircut before projecting forward. */
export const PACE_CONSERVATISM = 0.85;

/** Sustained fat loss above ~1% of body weight per week is not a rate worth promising. */
export const MAX_WEEKLY_FAT_LOSS_FRACTION = 0.01;

export type FatMassSample = {
  timeMs: number;
  weightKg: number;
  fatMassKg: number;
  bodyFatPct: number;
  /** True when body fat was carried forward from an earlier entry rather than measured. */
  derived: boolean;
};

/**
 * Turns mixed entries into a fat-mass series.
 *
 * Daily weigh-ins rarely include a body-fat reading, and requiring one meant a user who only
 * stepped on the scale had no pace, no milestones, and a hero frozen at the last full entry.
 */
export function buildFatMassSeries(measurements: BodyCompositionRecord[]): FatMassSample[] {
  const sorted = [...measurements]
    .filter((m) => m.weightKg != null && Number.isFinite(m.weightKg))
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());

  const series: FatMassSample[] = [];
  let lastWeight: number | undefined;
  let lastFatMass: number | undefined;

  for (const record of sorted) {
    const weightKg = record.weightKg!;
    const timeMs = new Date(record.recordedAt).getTime();
    if (!Number.isFinite(timeMs)) continue;

    let fatMassKg: number | undefined;
    let derived = true;

    if (record.bodyFatPct != null && Number.isFinite(record.bodyFatPct)) {
      fatMassKg = weightKg * (record.bodyFatPct / 100);
      derived = false;
    } else if (lastFatMass != null && lastWeight != null) {
      fatMassKg = Math.max(0, lastFatMass + (weightKg - lastWeight) * FAT_SHARE_OF_WEIGHT_CHANGE);
    }

    // Before any body-fat reading exists there is no baseline to carry forward.
    if (fatMassKg == null) continue;

    series.push({
      timeMs,
      weightKg,
      fatMassKg,
      bodyFatPct: (fatMassKg / weightKg) * 100,
      derived,
    });
    lastWeight = weightKg;
    lastFatMass = fatMassKg;
  }

  return series;
}

/** Least-squares slope in kg/week. Daily scale noise makes first-vs-last far too jumpy. */
function fatLossSlopeKgPerWeek(samples: FatMassSample[]): number | undefined {
  if (samples.length < 2) return undefined;

  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const baseTime = samples[0].timeMs;
  const xs = samples.map((s) => (s.timeMs - baseTime) / weekMs);
  const ys = samples.map((s) => s.fatMassKg);

  const spanWeeks = xs[xs.length - 1] - xs[0];
  if (spanWeeks < 0.5) return undefined;

  const n = xs.length;
  const meanX = xs.reduce((sum, x) => sum + x, 0) / n;
  const meanY = ys.reduce((sum, y) => sum + y, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i += 1) {
    numerator += (xs[i] - meanX) * (ys[i] - meanY);
    denominator += (xs[i] - meanX) ** 2;
  }
  if (denominator === 0) return undefined;

  // Slope is fat change per week; losing fat is a negative slope, so flip it to a loss rate.
  return -(numerator / denominator);
}

/**
 * Trailing fat-loss rate in kg/week, deliberately conservative:
 * recent window only, regression rather than endpoints, a slowdown haircut, and a hard cap.
 */
export function computePaceKgPerWeek(
  measurements: BodyCompositionRecord[],
  options?: { now?: Date; windowDays?: number; conservatism?: number },
): number | undefined {
  const series = buildFatMassSeries(measurements);
  if (series.length < 2) return undefined;

  const now = options?.now ?? new Date();
  const windowDays = options?.windowDays ?? PACE_WINDOW_DAYS;
  const cutoff = now.getTime() - windowDays * 24 * 60 * 60 * 1000;

  const recent = series.filter((s) => s.timeMs >= cutoff);
  // Fall back to the full history when the window is too sparse to fit a line.
  const windowed = recent.length >= 2 ? recent : series;

  const slope = fatLossSlopeKgPerWeek(windowed);
  if (slope == null || slope <= 0) return undefined;

  const latest = windowed[windowed.length - 1];
  const cap = latest.weightKg * MAX_WEEKLY_FAT_LOSS_FRACTION;
  const conservatism = options?.conservatism ?? PACE_CONSERVATISM;

  const pace = Math.min(slope * conservatism, cap);
  if (!Number.isFinite(pace) || pace <= 0) return undefined;
  return round1(pace);
}

/**
 * One timeline drives every date on screen.
 *
 * The stored projection models a body-fat *percentage* drop from adherence, while milestones use
 * measured fat-loss pace. Showing both let the hero claim a finish ~47 weeks after the milestone
 * that reaches the same body fat. Measured pace wins whenever it exists; the stored plan is the
 * fallback and stays the baseline that "ahead / behind schedule" compares against.
 */
export function resolveTimelineWeeks(params: {
  requiredFatLossKg: number;
  paceKgPerWeek?: number;
  projectedWeeks?: number;
}): { weeks?: number; source: 'pace' | 'plan' | 'none' } {
  const { requiredFatLossKg, paceKgPerWeek, projectedWeeks } = params;

  if (paceKgPerWeek != null && paceKgPerWeek > 0 && requiredFatLossKg > 0) {
    const weeks = requiredFatLossKg / paceKgPerWeek;
    if (Number.isFinite(weeks) && weeks > 0) return { weeks, source: 'pace' };
  }

  if (projectedWeeks != null && projectedWeeks > 0) {
    return { weeks: projectedWeeks, source: 'plan' };
  }

  return { source: 'none' };
}

export function resolveScheduleStatus(params: {
  progressPercent: number;
  projectedWeeks?: number;
  paceKgPerWeek?: number;
  requiredFatLossKg: number;
  currentBf: number;
  goalBf: number;
}): { status: ScheduleStatus; label: string; weeksAhead?: number } {
  if (params.currentBf <= params.goalBf + 0.3) {
    return { status: 'at_goal', label: 'Goal reached' };
  }

  if (!params.projectedWeeks || params.projectedWeeks <= 0) {
    return { status: 'unknown', label: 'Building baseline' };
  }

  if (!params.paceKgPerWeek || params.paceKgPerWeek <= 0) {
    return { status: 'on_track', label: 'On track' };
  }

  const weeksAtPace = params.requiredFatLossKg / params.paceKgPerWeek;
  const delta = params.projectedWeeks - weeksAtPace;

  if (delta >= 1.5) {
    return { status: 'ahead', label: 'Ahead of schedule', weeksAhead: round1(delta) };
  }
  if (delta <= -1.5) {
    return { status: 'behind', label: 'Behind schedule', weeksAhead: round1(delta) };
  }
  return { status: 'on_track', label: 'On track' };
}

export function buildCoachInsights(params: {
  progressPercent: number;
  scheduleLabel: string;
  weeksAhead?: number;
  nutritionAdherencePct?: number;
  workoutAdherencePct?: number;
  goalBf: number;
  estimatedCompletionDate?: string;
}): string[] {
  const insights: string[] = [];
  insights.push(`You are ${params.progressPercent}% of the way to your ${params.goalBf}% body fat goal.`);

  if (params.weeksAhead != null && params.weeksAhead >= 1) {
    const weeks = Math.round(params.weeksAhead);
    insights.push(`Your current pace projects success ${weeks} week${weeks === 1 ? '' : 's'} early.`);
  } else if (params.scheduleLabel === 'Behind schedule') {
    insights.push('Tighten nutrition consistency this week to get back on timeline.');
  } else if (params.estimatedCompletionDate) {
    insights.push(`Stay consistent to reach your goal by ${formatDisplayDate(params.estimatedCompletionDate)}.`);
  }

  if (params.nutritionAdherencePct != null && params.nutritionAdherencePct >= 75) {
    insights.push('Protein adherence is improving body composition.');
  } else if (params.nutritionAdherencePct != null && params.nutritionAdherencePct < 60) {
    insights.push('Hit protein targets daily to protect lean mass while cutting.');
  }

  if (params.workoutAdherencePct != null && params.workoutAdherencePct >= 80) {
    insights.push('Training consistency is supporting your transformation pace.');
  }

  return insights.slice(0, 4);
}

export function buildTransformationStory(
  projection: TransformationProjection,
  measurements: BodyCompositionRecord[],
  now = new Date(),
): TransformationStory {
  const storedCurrent = normalizeBodyCompositionSnapshot(projection.current);
  const storedGoal = normalizeBodyCompositionSnapshot(projection.projected);
  if (!storedCurrent || !storedGoal) {
    throw new Error('Invalid transformation projection snapshot');
  }

  const current = resolveCurrentSnapshot(storedCurrent, measurements, projection.createdAt);
  // Lean mass moves with each measurement, so the goal weight has to follow it rather than stay
  // pinned to whatever the last projection run computed.
  const goal =
    current === storedCurrent
      ? storedGoal
      : projectGoalSnapshot(current, projection.targetBodyFatPct);

  const start = resolveStartSnapshot(measurements, current);

  const startBf = start?.bodyFatPct ?? current.bodyFatPct + 4;
  const startWeight = start?.weightKg ?? current.weightKg;
  const progressPercent = computeProgressPercent(startBf, current.bodyFatPct, projection.targetBodyFatPct);

  const requiredFatLossKg = round1(Math.max(0, current.fatMassKg - goal.fatMassKg));
  const paceFromHistory = computePaceKgPerWeek(measurements, { now });
  const projectedWeeks = projection.projectedWeeksToTarget;

  let currentPaceKgPerWeek = paceFromHistory;
  if (currentPaceKgPerWeek == null && projectedWeeks && projectedWeeks > 0) {
    currentPaceKgPerWeek = round1(requiredFatLossKg / projectedWeeks);
  }

  const timeline = resolveTimelineWeeks({
    requiredFatLossKg,
    paceKgPerWeek: currentPaceKgPerWeek,
    projectedWeeks,
  });

  let daysRemaining: number | undefined;
  let estimatedCompletionDate: string | undefined;
  if (timeline.weeks != null) {
    daysRemaining = Math.round(timeline.weeks * 7);
    estimatedCompletionDate = formatIsoDate(addDays(now, daysRemaining));
  }

  const schedule = resolveScheduleStatus({
    progressPercent,
    projectedWeeks,
    paceKgPerWeek: currentPaceKgPerWeek,
    requiredFatLossKg,
    currentBf: current.bodyFatPct,
    goalBf: projection.targetBodyFatPct,
  });

  const milestones: BodyFatMilestone[] = BODY_FAT_MILESTONES.filter(
    (pct) => pct <= startBf + 0.5 && pct >= projection.targetBodyFatPct - 0.5,
  )
    .sort((a, b) => b - a)
    .map((bodyFatPct) => ({
      bodyFatPct,
      reached: current.bodyFatPct <= bodyFatPct + 0.2,
      estimatedDate: estimateMilestoneDate(
        current.bodyFatPct,
        bodyFatPct,
        currentPaceKgPerWeek,
        current.weightKg,
        now,
      ),
    }));

  const coachInsights = buildCoachInsights({
    progressPercent,
    scheduleLabel: schedule.label,
    weeksAhead: schedule.weeksAhead,
    nutritionAdherencePct: projection.nutritionAdherencePct,
    workoutAdherencePct: projection.workoutAdherencePct,
    goalBf: projection.targetBodyFatPct,
    estimatedCompletionDate,
  });

  return {
    currentWeightKg: current.weightKg,
    currentBodyFatPct: current.bodyFatPct,
    goalWeightKg: goal.weightKg,
    goalBodyFatPct: projection.targetBodyFatPct,
    daysRemaining,
    estimatedCompletionDate,
    progressPercent,
    startWeightKg: startWeight,
    startBodyFatPct: startBf,
    requiredFatLossKg,
    currentPaceKgPerWeek,
    scheduleStatus: schedule.status,
    scheduleLabel: schedule.label,
    weeksAhead: schedule.weeksAhead,
    coachInsights,
    milestones,
  };
}

export function formatMassFromKg(
  kg: number,
  formatWeight: (value: number) => string,
): string {
  return formatWeight(kg);
}

export function formatPaceFromKgPerWeek(
  kgPerWeek: number | undefined,
  weightUnit: 'kg' | 'lb',
): string | undefined {
  if (kgPerWeek == null || kgPerWeek <= 0) return undefined;
  if (weightUnit === 'kg') return `${round1(kgPerWeek)} kg/week`;
  return `${round1(kgPerWeek * 2.2046226218)} lb/week`;
}

export { formatDisplayDate };
