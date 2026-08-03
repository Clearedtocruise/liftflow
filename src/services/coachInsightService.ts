import { findStrengthGain, type CoachSetSample, type StrengthGain } from '@/lib/coachInsight';
import { supabase } from '@/supabase/client';
import { fail, fromError, ok } from '@/lib/serviceResult';
import type { ServiceResult } from '@/types/common';

const LOOKBACK_DAYS = 63;

/**
 * The sets behind the home screen's coach card. Reads sets rather than `performance_trends` because
 * trends are written by a snapshot job that may not have run, whereas a logged set always exists the
 * moment the lifter records it.
 */
export const coachInsightService = {
  async getStrengthGain(userId: string): Promise<ServiceResult<StrengthGain | null>> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - LOOKBACK_DAYS);

      const { data, error } = await supabase
        .from('workout_sets')
        .select(
          'weight, reps, logged_at, workout_exercises!inner(exercises!inner(name), workout_sessions!inner(user_id))',
        )
        .eq('workout_exercises.workout_sessions.user_id', userId)
        .gte('logged_at', since.toISOString())
        .order('logged_at', { ascending: false })
        .limit(2000);

      if (error) return fail(error.message);

      const samples: CoachSetSample[] = (data ?? []).flatMap((row) => {
        const joined = row as unknown as {
          weight: number | null;
          reps: number | null;
          logged_at: string;
          workout_exercises?: { exercises?: { name?: string } };
        };
        const name = joined.workout_exercises?.exercises?.name;
        if (!name) return [];
        return [
          {
            exerciseName: name,
            weightKg: joined.weight ?? undefined,
            reps: joined.reps ?? undefined,
            loggedAt: joined.logged_at,
          },
        ];
      });

      return ok(findStrengthGain(samples));
    } catch (e) {
      return fromError(e);
    }
  },
};
