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

export function resolveStartSnapshot(
  measurements: BodyCompositionRecord[],
  current: BodyCompositionSnapshot,
): BodyCompositionSnapshot | null {
  const withBf = [...measurements]
    .filter((m) => m.weightKg != null && m.bodyFatPct != null)
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());

  const oldest = withBf[0];
  if (!oldest?.weightKg || oldest.bodyFatPct == null) return null;

  const fatMassKg = round1(oldest.weightKg * (oldest.bodyFatPct / 100));
  const leanMassKg = round1(oldest.weightKg - fatMassKg);
  return {
    weightKg: round1(oldest.weightKg),
    bodyFatPct: round1(oldest.bodyFatPct),
    leanMassKg,
    fatMassKg,
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

  const currentFatKg = currentWeightKg * (currentBf / 100);
  const targetFatKg = currentWeightKg * (milestoneBf / 100);
  const fatToLose = Math.max(0, currentFatKg - targetFatKg);
  const weeks = fatToLose / paceKgPerWeek;
  if (!Number.isFinite(weeks) || weeks <= 0) return undefined;
  return formatIsoDate(addDays(now, Math.round(weeks * 7)));
}

export function computePaceKgPerWeek(
  measurements: BodyCompositionRecord[],
): number | undefined {
  const samples = [...measurements]
    .filter((m) => m.weightKg != null && m.bodyFatPct != null)
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());

  if (samples.length < 2) return undefined;

  const first = samples[0];
  const last = samples[samples.length - 1];
  if (!first.weightKg || first.bodyFatPct == null || !last.weightKg || last.bodyFatPct == null) {
    return undefined;
  }

  const firstFat = first.weightKg * (first.bodyFatPct / 100);
  const lastFat = last.weightKg * (last.bodyFatPct / 100);
  const fatDelta = firstFat - lastFat;
  const ms = new Date(last.recordedAt).getTime() - new Date(first.recordedAt).getTime();
  const weeks = ms / (7 * 24 * 60 * 60 * 1000);
  if (weeks < 0.5) return undefined;
  return round1(fatDelta / weeks);
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
  const current = projection.current;
  const goal = projection.projected;
  const start = resolveStartSnapshot(measurements, current);

  const startBf = start?.bodyFatPct ?? current.bodyFatPct + 4;
  const startWeight = start?.weightKg ?? current.weightKg;
  const progressPercent = computeProgressPercent(startBf, current.bodyFatPct, projection.targetBodyFatPct);

  const requiredFatLossKg = round1(Math.max(0, current.fatMassKg - goal.fatMassKg));
  const paceFromHistory = computePaceKgPerWeek(measurements);
  const projectedWeeks = projection.projectedWeeksToTarget;

  let currentPaceKgPerWeek = paceFromHistory;
  if (currentPaceKgPerWeek == null && projectedWeeks && projectedWeeks > 0) {
    currentPaceKgPerWeek = round1(requiredFatLossKg / projectedWeeks);
  }

  let daysRemaining: number | undefined;
  let estimatedCompletionDate: string | undefined;

  if (projectedWeeks != null && projectedWeeks > 0) {
    daysRemaining = Math.round(projectedWeeks * 7);
    estimatedCompletionDate = formatIsoDate(addDays(now, daysRemaining));
  } else if (currentPaceKgPerWeek && currentPaceKgPerWeek > 0) {
    const weeks = requiredFatLossKg / currentPaceKgPerWeek;
    daysRemaining = Math.round(weeks * 7);
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
