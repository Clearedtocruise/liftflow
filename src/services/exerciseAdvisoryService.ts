import { apiClient } from '@/api/client';
import { buildLocalExerciseAlternatives } from '@/lib/exerciseLocalAlternatives';
import { ok } from '@/lib/serviceResult';
import { getAccessToken } from '@/supabase/client';

export type ExerciseAlternativeOption = {
  name: string;
  slug: string;
  muscleGroups: string[];
  equipment: string;
  reason: string;
};

export type ExerciseAlternativesResult = {
  reasoning: string;
  alternatives: ExerciseAlternativeOption[];
};

export type ExerciseAlternativesRequest = {
  userId: string;
  exerciseName: string;
  muscleGroups?: string[];
  goal?: string;
  programType?: string;
  availableEquipment?: string[];
};

export const exerciseAdvisoryService = {
  async getExerciseAlternatives(request: ExerciseAlternativesRequest) {
    try {
      const token = await getAccessToken();
      const raw = await apiClient.post<{ data: ExerciseAlternativesResult }>(
        '/api/ai/advisory/workout/exercise-alternatives',
        request,
        token,
      );

      if (raw.data?.alternatives?.length) {
        return ok(raw.data);
      }
    } catch (e) {
      if (__DEV__) {
        console.warn('[exerciseAdvisoryService] alternatives fallback', e);
      }
    }

    const alternatives = buildLocalExerciseAlternatives(
      request.exerciseName,
      request.muscleGroups,
      5,
    );

    return ok({
      reasoning: 'Showing on-device exercise suggestions while coach AI is unavailable.',
      alternatives,
    } satisfies ExerciseAlternativesResult);
  },
};

export type ExerciseAdvisoryService = typeof exerciseAdvisoryService;
