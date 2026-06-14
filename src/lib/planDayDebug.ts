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
): void {
  const payload = {
    source,
    activeTrainingDay,
    weeklyPlan,
    availableMoveTargets,
  };
  console.info(`[plan-day] ${JSON.stringify(payload)}`);
}
