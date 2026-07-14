import { apiClient } from '@/api/client';
import { fromError, ok } from '@/lib/serviceResult';
import { getAccessToken } from '@/supabase/client';
import type { CoachActivationResult, PostWorkoutCoachSummary } from '@/types/coachActivation';
import type { ProgramDashboard } from '@/types/training';

const POST_WORKOUT_COACH_TIMEOUT_MS = 12_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Coach summary timed out')), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function mapProgramDashboard(raw: Record<string, unknown>): ProgramDashboard | null {
  if (!raw.program) return null;
  const program = raw.program as Record<string, unknown>;
  return {
    program: {
      id: program.id as string,
      userId: program.user_id as string,
      name: program.name as string,
      description: program.description as string | undefined,
      durationWeeks: program.duration_weeks as number | undefined,
      isActive: program.is_active as boolean,
      metadata: (program.metadata as Record<string, unknown>) ?? undefined,
      createdAt: program.created_at as string,
    },
    phase: null,
    currentWeek: raw.currentWeek as number,
    completionPct: raw.completionPct as number,
    nextWorkout: raw.nextWorkout as ProgramDashboard['nextWorkout'],
    upcomingWorkouts: (raw.upcomingWorkouts as ProgramDashboard['upcomingWorkouts']) ?? [],
    totalPlanned: raw.totalPlanned as number,
    totalCompleted: raw.totalCompleted as number,
  };
}

export const coachActivationService = {
  async activate(userId: string) {
    try {
      const token = await getAccessToken();
      const raw = await apiClient.post<Record<string, unknown>>('/api/training/coach/activate', { userId }, token);
      const result: CoachActivationResult = {
        programDashboard: raw.programDashboard
          ? mapProgramDashboard(raw.programDashboard as Record<string, unknown>)
          : null,
        nutritionGoals: raw.nutritionGoals as CoachActivationResult['nutritionGoals'],
        coachMessage: String(raw.coachMessage ?? ''),
        supplementRecommendations:
          (raw.supplementRecommendations as CoachActivationResult['supplementRecommendations']) ?? [],
        mealPlanCreated: Boolean(raw.mealPlanCreated),
        groceryListCreated: Boolean(raw.groceryListCreated),
      };
      return ok(result);
    } catch (e) {
      return fromError(e);
    }
  },

  async getPostWorkoutSummary(
    userId: string,
    sessionId: string,
  ): Promise<import('@/types/common').ServiceResult<PostWorkoutCoachSummary>> {
    try {
      const token = await getAccessToken();
      const raw = await withTimeout(
        apiClient.post<PostWorkoutCoachSummary>(
          '/api/training/coach/post-workout',
          { userId, sessionId },
          token,
        ),
        POST_WORKOUT_COACH_TIMEOUT_MS,
      );
      return ok(raw);
    } catch (e) {
      return fromError(e);
    }
  },
};
