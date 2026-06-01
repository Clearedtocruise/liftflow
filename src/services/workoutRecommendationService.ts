import { apiClient } from '@/api/client';
import { fail, fromError, ok } from '@/lib/serviceResult';
import { getAccessToken } from '@/supabase/client';
import type { WorkoutRecommendationReport } from '@/types/workoutRecommendation';
import type { ServiceResult } from '@/types/common';

export const workoutRecommendationService = {
  async getDaily(userId: string): Promise<ServiceResult<WorkoutRecommendationReport>> {
    try {
      const token = await getAccessToken();
      const report = await apiClient.get<WorkoutRecommendationReport>(
        `/api/training/recommendations/daily?userId=${userId}`,
        token,
      );
      return ok(report);
    } catch (e) {
      return fromError(e);
    }
  },
};
