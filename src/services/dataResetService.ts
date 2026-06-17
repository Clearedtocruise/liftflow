import AsyncStorage from '@react-native-async-storage/async-storage';

import { fail, fromError, ok } from '@/lib/serviceResult';
import { getWeekRange } from '@/lib/weekPlan';
import { nutritionService } from '@/services/nutritionService';
import { supabase } from '@/supabase/client';
import type { ServiceResult } from '@/types/common';

export type DataResetSummary = {
  cancelledSessions: number;
  resetPlannedWorkouts: number;
  clearedCacheKeys: number;
  nutritionDaysSynced: number;
};

const AUTH_KEY_HINTS = ['supabase', 'auth-token', 'gotrue'];

async function clearLocalAppCache(): Promise<number> {
  const keys = await AsyncStorage.getAllKeys();
  const toRemove = keys.filter((key) => {
    const lower = key.toLowerCase();
    if (AUTH_KEY_HINTS.some((hint) => lower.includes(hint))) return false;
    return key.startsWith('@liftflow/') || key.startsWith('liftflow_');
  });
  if (toRemove.length > 0) await AsyncStorage.multiRemove(toRemove);
  return toRemove.length;
}

export const dataResetService = {
  /** Clears stuck workouts, local cache, and refreshes this week's nutrition — keeps account & history. */
  async resetAppData(userId: string, timeZone?: string | null): Promise<ServiceResult<DataResetSummary>> {
    try {
      const now = new Date().toISOString();

      const { data: activeSessions, error: sessionsError } = await supabase
        .from('workout_sessions')
        .select('id')
        .eq('user_id', userId)
        .in('status', ['active', 'paused']);

      if (sessionsError) return fail(sessionsError.message);

      const cancelledSessions = activeSessions?.length ?? 0;
      if (cancelledSessions > 0) {
        const { error } = await supabase
          .from('workout_sessions')
          .update({ status: 'cancelled', ended_at: now })
          .eq('user_id', userId)
          .in('status', ['active', 'paused']);
        if (error) return fail(error.message);
      }

      const { data: stuckPlanned, error: plannedError } = await supabase
        .from('planned_workouts')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active');

      if (plannedError) return fail(plannedError.message);

      const resetPlannedWorkouts = stuckPlanned?.length ?? 0;
      if (resetPlannedWorkouts > 0) {
        const { error } = await supabase
          .from('planned_workouts')
          .update({ status: 'planned' })
          .eq('user_id', userId)
          .eq('status', 'active');
        if (error) return fail(error.message);
      }

      const { from, to } = getWeekRange(new Date(), timeZone);
      await nutritionService.pruneDuplicateMeals(userId, { from, to });
      const syncResult = await nutritionService.ensureWeekMealCoverage(userId, timeZone);

      const clearedCacheKeys = await clearLocalAppCache();

      return ok({
        cancelledSessions,
        resetPlannedWorkouts,
        clearedCacheKeys,
        nutritionDaysSynced: syncResult.success ? syncResult.data : 0,
      });
    } catch (e) {
      return fromError(e);
    }
  },
};
