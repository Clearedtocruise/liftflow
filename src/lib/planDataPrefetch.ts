import { planDataCache } from '@/lib/planDataCache';
import { logStartup } from '@/lib/startupLogger';
import { getWeekRange } from '@/lib/weekPlan';
import { withTimeout } from '@/lib/withTimeout';
import { nutritionService } from '@/services/nutritionService';
import { trainingService } from '@/services/trainingService';

function weekKey(userId: string, weekFrom: string, weekTo: string): string {
  return `${userId}:${weekFrom}:${weekTo}`;
}

const inflight = new Map<string, Promise<void>>();

export function invalidateWeekPlanPrefetch(userId: string, timezone?: string): void {
  const { from, to } = getWeekRange(new Date(), timezone);
  inflight.delete(weekKey(userId, from, to));
}

/** Kick off AsyncStorage read + network warm as early as auth allows. */
export function startPlanPrefetch(userId: string, timezone?: string): void {
  const { from, to } = getWeekRange(new Date(), timezone);
  planDataCache.prefetchWeek(userId, from, to);
  void warmWeekPlanData(userId, timezone);
}

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
        withTimeout(trainingService.getPlannedWorkouts(userId, from, to, timezone), 8_000, 'prefetch workouts'),
        withTimeout(nutritionService.getMealsForWeek(userId, from, to), 8_000, 'prefetch meals'),
        withTimeout(nutritionService.getGoals(userId), 8_000, 'prefetch goals'),
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

/** Optionally wait briefly for auth prefetch — never block UI longer than maxWaitMs. */
export async function awaitWarmWeekPlanData(
  userId: string,
  timezone?: string,
  maxWaitMs = 1_500,
): Promise<void> {
  const warm = getWarmWeekPlanData(userId, timezone);
  if (!warm) return;
  await withTimeout(warm, maxWaitMs, 'plan prefetch wait').catch(() => undefined);
}
