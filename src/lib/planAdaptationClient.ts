import { getWeekRange } from '@/lib/weekPlan';
import { nutritionService } from '@/services/nutritionService';
import type { PlanAdaptationResult } from '@/types/planAdaptation';

/** Client-side follow-up after plan/adapt — grocery sync for the current week. */
export async function syncGroceriesAfterPlanAdaptation(userId: string, _result?: PlanAdaptationResult) {
  const { from, to } = getWeekRange();
  await nutritionService.syncGroceryListFromMeals(userId, from, to);
}
