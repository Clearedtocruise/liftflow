import { api } from '@/api/client';
import { fromError, ok } from '@/lib/serviceResult';
import {
    computeSmartProgression,
    mapFitnessGoalsToFocus,
} from '@/lib/smartProgressionEngine';
import { getAccessToken } from '@/supabase/client';
import type { ServiceResult } from '@/types/common';
import type { ProgressionSetRecord, SmartProgressionRecommendation } from '@/types/progression';

export const progressionService = {
  async getSmartProgression(
    userId: string,
    exerciseId: string,
    options?: {
      exerciseName?: string;
      sessionId?: string;
      currentSessionSets?: ProgressionSetRecord[];
      recoveryScore?: number;
      recoveryVolumeMultiplier?: number;
    },
  ): Promise<ServiceResult<SmartProgressionRecommendation>> {
    try {
      const token = await getAccessToken();
      const remote = await api.postSmartProgression(
        {
          userId,
          exerciseId,
          sessionId: options?.sessionId,
          currentSessionSets: options?.currentSessionSets,
        },
        token,
      );
      return ok(remote);
    } catch {
      const local = computeSmartProgression({
        exerciseName: options?.exerciseName ?? 'Exercise',
        exerciseId,
        priorSessions: [],
        currentSessionSets: options?.currentSessionSets ?? [],
        goalFocus: mapFitnessGoalsToFocus(undefined),
        recoveryScore: options?.recoveryScore ?? 72,
        recoveryVolumeMultiplier: options?.recoveryVolumeMultiplier ?? 1,
      });
      return ok(local);
    }
  },

  computeLocal(
    input: Parameters<typeof computeSmartProgression>[0],
  ): SmartProgressionRecommendation {
    return computeSmartProgression(input);
  },

  fromError,
};
