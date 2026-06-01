import { apiClient } from '@/api/client';
import { fail, fromError, ok } from '@/lib/serviceResult';
import { getAccessToken } from '@/supabase/client';
import type { NutritionIntelligenceReport } from '@/types/nutritionIntelligence';
import type { ServiceResult } from '@/types/common';

export const nutritionIntelligenceService = {
  async getIntelligence(userId: string): Promise<ServiceResult<NutritionIntelligenceReport>> {
    try {
      const token = await getAccessToken();
      const report = await apiClient.get<NutritionIntelligenceReport>(
        `/api/nutrition/intelligence?userId=${userId}`,
        token,
      );
      return ok(report);
    } catch (e) {
      return fromError(e);
    }
  },
};
