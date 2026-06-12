import { apiClient } from '@/api/client';
import { fail, fromError, ok } from '@/lib/serviceResult';
import { getAccessToken } from '@/supabase/client';
import type { PreferenceAdaptationReport, PreferenceAdaptationTrigger } from '@/types/adaptation';
import type { ServiceResult } from '@/types/common';

export const adaptationService = {
  async applyChanges(
    userId: string,
    trigger: PreferenceAdaptationTrigger,
  ): Promise<ServiceResult<PreferenceAdaptationReport>> {
    try {
      const token = await getAccessToken();
      const report = await apiClient.post<PreferenceAdaptationReport>(
        '/api/training/preferences/adapt',
        { userId, trigger },
        token,
      );
      return ok(report);
    } catch (e) {
      return fromError(e);
    }
  },

  fromError,
  fail,
};
