import AsyncStorage from '@react-native-async-storage/async-storage';

import { resolveActiveTrainingDay } from '@/lib/activeTrainingDay';
import { localDateString } from '@/lib/localDate';
import { getWeekRange } from '@/lib/weekPlan';
import { nutritionService } from '@/services/nutritionService';
import { trainingService } from '@/services/trainingService';
import { supabase } from '@/supabase/client';

const LAST_RESET_KEY = '@liftflow/debug/last_reset_at';
const LAST_DAILY_ROLLOVER_KEY = '@liftflow/debug/last_daily_rollover_at';
const LAST_WEEKLY_ROLLOVER_KEY = '@liftflow/debug/last_weekly_rollover_at';

export type RolloverDebugTimestamps = {
  lastResetTime: string | null;
  lastDailyRollover: string | null;
  lastWeeklyRollover: string | null;
};

export type RolloverValidationState = RolloverDebugTimestamps & {
  currentLocalDate: string;
  currentTrainingDay: string;
  currentWorkoutWeek: string;
  currentNutritionWeek: string;
  activeWorkoutPlanId: string | null;
  activeNutritionPlanId: string | null;
  trainingWeekNumber: number | null;
};

export async function recordResetTime(): Promise<void> {
  await AsyncStorage.setItem(LAST_RESET_KEY, new Date().toISOString());
}

export async function recordDailyRolloverTime(): Promise<void> {
  await AsyncStorage.setItem(LAST_DAILY_ROLLOVER_KEY, new Date().toISOString());
}

export async function recordWeeklyRolloverTime(): Promise<void> {
  await AsyncStorage.setItem(LAST_WEEKLY_ROLLOVER_KEY, new Date().toISOString());
}

export async function getRolloverDebugTimestamps(): Promise<RolloverDebugTimestamps> {
  const entries = await AsyncStorage.multiGet([
    LAST_RESET_KEY,
    LAST_DAILY_ROLLOVER_KEY,
    LAST_WEEKLY_ROLLOVER_KEY,
  ]);
  const map = Object.fromEntries(entries);
  return {
    lastResetTime: map[LAST_RESET_KEY] ?? null,
    lastDailyRollover: map[LAST_DAILY_ROLLOVER_KEY] ?? null,
    lastWeeklyRollover: map[LAST_WEEKLY_ROLLOVER_KEY] ?? null,
  };
}

export async function loadRolloverValidationState(
  userId: string,
  timeZone?: string | null,
): Promise<RolloverValidationState> {
  const reference = new Date();
  const currentLocalDate = localDateString(reference, timeZone);
  const { from: currentWorkoutWeek } = getWeekRange(reference, timeZone);

  const [timestamps, dashboardRes, plannedRes, mealPlansRes, activeProgramRes] = await Promise.all([
    getRolloverDebugTimestamps(),
    trainingService.getDashboard(userId),
    trainingService.getPlannedWorkouts(userId, currentWorkoutWeek, getWeekRange(reference, timeZone).to, timeZone),
    nutritionService.getMealPlans(userId),
    supabase
      .from('training_programs')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle(),
  ]);

  const planned = plannedRes.success ? plannedRes.data : [];
  const activeDay = resolveActiveTrainingDay(planned, { date: currentLocalDate, timeZone, reference });

  const mealPlans = mealPlansRes.success ? mealPlansRes.data : [];
  const nutritionPlan =
    mealPlans.find((plan) => plan.weekStartDate === currentWorkoutWeek) ??
    mealPlans.find((plan) => plan.weekStartDate <= currentLocalDate) ??
    mealPlans[0] ??
    null;

  // getDashboard resolves to `ProgramDashboard | null`, so a successful call still carries no
  // dashboard for a user without an active program. Reading through it threw and took the whole
  // Settings screen's validation panel with it.
  const dashboard = dashboardRes.success ? dashboardRes.data : null;
  const trainingWeekNumber = dashboard?.currentWeek ?? null;
  const activeWorkoutPlanId =
    (activeProgramRes.data?.id as string | undefined) ?? dashboard?.program.id ?? null;

  return {
    ...timestamps,
    currentLocalDate,
    currentTrainingDay: activeDay.workoutName ?? (activeDay.isScheduledRestDay ? 'Rest day' : 'Unassigned'),
    currentWorkoutWeek,
    currentNutritionWeek: nutritionPlan?.weekStartDate ?? currentWorkoutWeek,
    activeWorkoutPlanId,
    activeNutritionPlanId: nutritionPlan?.id ?? null,
    trainingWeekNumber,
  };
}
