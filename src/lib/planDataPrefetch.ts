import { planDataCache } from '@/lib/planDataCache';
import { logStartup } from '@/lib/startupLogger';
import { getWeekRange } from '@/lib/weekPlan';
import { nutritionService } from '@/services/nutritionService';
import { trainingService } from '@/services/trainingService';

function weekKey(userId: string, weekFrom: string, weekTo: string): string {
  return `${userId}:${weekFrom}:${weekTo}`;
}

const inflight = new Map<string, Promise<void>>();

/** Fetch week plan data once and write to planDataCache (shared across tabs). */
export function warmWeekPlanData(userId: string, timezone?: string): Promise<void> {
  const { from, to } = getWeekRange(new Date(), timezone);
  const key = weekKey(userId, from, to);
  const existing = inflight.get(key);
  if (existing) return existing;

  const task = (async () => {
    try {
      logStartup('PLAN_PREFETCH_START');
      const [workoutsRes, mealsRes, goalsRes] = await Promise.allSettled([
        trainingService.getPlannedWorkouts(userId, from, to, timezone),
        nutritionService.getMealsForWeek(userId, from, to),
        nutritionService.getGoals(userId),
      ]);

      if (workoutsRes.status === 'fulfilled' && workoutsRes.value.success) {
        await planDataCache.writeWorkouts(userId, from, to, workoutsRes.value.data);
      }
      if (mealsRes.status === 'fulfilled' && mealsRes.value.success) {
        await planDataCache.writeMeals(userId, from, to, mealsRes.value.data);
      }
      if (goalsRes.status === 'fulfilled' && goalsRes.value.success) {
        await planDataCache.writeGoals(userId, goalsRes.value.data);
      }

      logStartup('PLAN_PREFETCH_DONE');
    } catch (error) {
      console.warn('[planDataPrefetch] warm failed', error);
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, task);
  return task;
}

export function getWarmWeekPlanData(userId: string, timezone?: string): Promise<void> | undefined {
  const { from, to } = getWeekRange(new Date(), timezone);
  return inflight.get(weekKey(userId, from, to));
}

/** Wait for an in-flight warm (if any) so tabs reuse auth prefetch instead of duplicating fetches. */
export async function awaitWarmWeekPlanData(userId: string, timezone?: string): Promise<void> {
  const warm = getWarmWeekPlanData(userId, timezone);
  if (warm) await warm.catch(() => undefined);
}
