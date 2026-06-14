import type { ActiveTrainingDay } from '@/lib/activeTrainingDay';
import type { WeeklyPlanEntry } from '@/lib/weekPlan';

export type PlanDayMoveTarget = {
  day: string;
  date: string;
  title: string;
  workoutId: string | null;
};

export function logPlanDayContext(
  source: string,
  activeTrainingDay: string,
  weeklyPlan: WeeklyPlanEntry[],
  availableMoveTargets: PlanDayMoveTarget[],
  resolved?: ActiveTrainingDay,
): void {
  const payload = {
    source,
    activeTrainingDay,
    resolvedWorkout: resolved?.workoutName ?? null,
    isScheduledRestDay: resolved?.isScheduledRestDay ?? null,
    weeklyPlan,
    availableMoveTargets,
  };
  console.info(`[plan-day] ${JSON.stringify(payload)}`);
}
