import AsyncStorage from '@react-native-async-storage/async-storage';

import { api } from '@/api/client';
import { recordResetTime } from '@/lib/rolloverDebug';
import { fromError, ok } from '@/lib/serviceResult';
import { getWeekRange } from '@/lib/weekPlan';
import { nutritionService } from '@/services/nutritionService';
import { getAccessToken, supabase } from '@/supabase/client';
import type { ServiceResult } from '@/types/common';

export type DataResetType = 'workout' | 'nutrition' | 'both' | 'full';

export type DataResetSummary = {
  workoutSessions: number;
  loggedSets: number;
  nutritionLogs: number;
  mealPlans: number;
  workoutPlans: number;
};

const AUTH_KEY_HINTS = ['supabase', 'auth-token', 'gotrue'];

async function clearLocalAppCache(): Promise<number> {
  const keys = await AsyncStorage.getAllKeys();
  const toRemove = keys.filter((key) => {
    const lower = key.toLowerCase();
    if (AUTH_KEY_HINTS.some((hint) => lower.includes(hint))) return false;
    if (key.startsWith('@liftflow/debug/')) return false;
    return key.startsWith('@liftflow/') || key.startsWith('liftflow_');
  });
  if (toRemove.length > 0) await AsyncStorage.multiRemove(toRemove);
  return toRemove.length;
}

async function countLoggedSets(userId: string): Promise<number> {
  const { data: sessions, error: sessionsError } = await supabase
    .from('workout_sessions')
    .select('id')
    .eq('user_id', userId);

  if (sessionsError || !sessions?.length) return 0;

  const sessionIds = sessions.map((row) => row.id);
  const { data: exercises, error: exercisesError } = await supabase
    .from('workout_exercises')
    .select('id')
    .in('session_id', sessionIds);

  if (exercisesError || !exercises?.length) return 0;

  const exerciseIds = exercises.map((row) => row.id);
  const { count, error: setsError } = await supabase
    .from('workout_sets')
    .select('*', { count: 'exact', head: true })
    .in('workout_exercise_id', exerciseIds);

  if (setsError) return 0;
  return count ?? 0;
}

async function deleteWorkoutData(userId: string): Promise<Pick<DataResetSummary, 'workoutSessions' | 'loggedSets' | 'workoutPlans'>> {
  const [
    { count: sessionCount, error: sessionCountError },
    loggedSets,
    { count: planCount, error: planCountError },
  ] = await Promise.all([
    supabase.from('workout_sessions').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    countLoggedSets(userId),
    supabase.from('planned_workouts').select('*', { count: 'exact', head: true }).eq('user_id', userId),
  ]);

  if (sessionCountError) throw new Error(sessionCountError.message);
  if (planCountError) throw new Error(planCountError.message);

  const workoutSessions = sessionCount ?? 0;
  const workoutPlans = planCount ?? 0;

  await supabase.from('cardio_sessions').delete().eq('user_id', userId);
  await supabase.from('weekly_closeouts').delete().eq('user_id', userId);
  await supabase.from('recovery_assessments').delete().eq('user_id', userId);
  await supabase.from('voice_log_entries').delete().eq('user_id', userId);
  await supabase.from('heart_rate_samples').delete().eq('user_id', userId);

  const { error: sessionDeleteError } = await supabase.from('workout_sessions').delete().eq('user_id', userId);
  if (sessionDeleteError) throw new Error(sessionDeleteError.message);

  const { error: planDeleteError } = await supabase.from('planned_workouts').delete().eq('user_id', userId);
  if (planDeleteError) throw new Error(planDeleteError.message);

  return { workoutSessions, loggedSets, workoutPlans };
}

async function deleteNutritionData(userId: string): Promise<Pick<DataResetSummary, 'nutritionLogs' | 'mealPlans'>> {
  const [{ count: mealCount, error: mealCountError }, { count: planCount, error: planCountError }] =
    await Promise.all([
      supabase.from('meals').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('meal_plans').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    ]);

  if (mealCountError) throw new Error(mealCountError.message);
  if (planCountError) throw new Error(planCountError.message);

  const nutritionLogs = mealCount ?? 0;
  const mealPlans = planCount ?? 0;

  await supabase.from('hydration_logs').delete().eq('user_id', userId);
  await supabase.from('grocery_lists').delete().eq('user_id', userId);
  await supabase.from('meals').delete().eq('user_id', userId);
  await supabase.from('meal_plans').delete().eq('user_id', userId);

  return { nutritionLogs, mealPlans };
}

async function clearEquipmentProfile(userId: string): Promise<void> {
  await supabase.from('workout_locations').delete().eq('user_id', userId);
  const { error } = await supabase
    .from('profiles')
    .update({
      available_equipment: [],
      primary_gym_name: null,
      training_location: null,
    })
    .eq('id', userId);
  if (error) throw new Error(error.message);
}

function emptySummary(): DataResetSummary {
  return {
    workoutSessions: 0,
    loggedSets: 0,
    nutritionLogs: 0,
    mealPlans: 0,
    workoutPlans: 0,
  };
}

function mergeSummary(base: DataResetSummary, patch: Partial<DataResetSummary>): DataResetSummary {
  return { ...base, ...patch };
}

export function formatResetConfirmation(summary: DataResetSummary): string {
  const total =
    summary.workoutSessions +
    summary.loggedSets +
    summary.nutritionLogs +
    summary.mealPlans +
    summary.workoutPlans;

  if (total === 0) return 'No matching test data found.';

  return [
    'Data Reset Complete',
    '',
    'Deleted:',
    `• ${summary.workoutSessions} workout sessions`,
    `• ${summary.loggedSets} logged sets`,
    `• ${summary.nutritionLogs} nutrition logs`,
    `• ${summary.mealPlans} meal plans`,
    `• ${summary.workoutPlans} workout plans`,
  ].join('\n');
}

export const dataResetService = {
  async resetData(
    userId: string,
    type: DataResetType,
    timeZone?: string | null,
  ): Promise<ServiceResult<DataResetSummary>> {
    try {
      let summary = emptySummary();

      const includesWorkout = type === 'workout' || type === 'both' || type === 'full';
      const includesNutrition = type === 'nutrition' || type === 'both' || type === 'full';

      if (includesWorkout) {
        summary = mergeSummary(summary, await deleteWorkoutData(userId));
      }

      if (includesNutrition) {
        summary = mergeSummary(summary, await deleteNutritionData(userId));
      }

      if (type === 'full') {
        await clearEquipmentProfile(userId);
      }

      await clearLocalAppCache();
      await recordResetTime();

      const { data: profileMeta } = await supabase
        .from('profiles')
        .select('metadata')
        .eq('id', userId)
        .maybeSingle();
      const coachProfile = (profileMeta?.metadata as {
        coachProfile?: { selfDirectedTraining?: boolean; selfDirectedNutrition?: boolean };
      } | null)?.coachProfile;

      if (includesWorkout && coachProfile?.selfDirectedTraining !== true) {
        const token = await getAccessToken();
        await api.regenerateProgram(userId, token, true);
      }

      if (includesNutrition) {
        const { from, to } = getWeekRange(new Date(), timeZone);
        // ensureWeekMealCoverage no-ops when self-directed nutrition is on.
        await nutritionService.ensureWeekMealCoverage(userId, timeZone);
        await nutritionService.pruneDuplicateMeals(userId, { from, to });
      }

      return ok(summary);
    } catch (e) {
      return fromError(e);
    }
  },

  /** @deprecated Use resetData(type) */
  async resetAppData(userId: string, timeZone?: string | null): Promise<ServiceResult<DataResetSummary>> {
    return this.resetData(userId, 'both', timeZone);
  },
};
