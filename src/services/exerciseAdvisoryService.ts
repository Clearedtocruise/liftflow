import { apiClient } from '@/api/client';
import { buildLocalExerciseAlternatives } from '@/lib/exerciseLocalAlternatives';
import { fromError, ok } from '@/lib/serviceResult';
import { withTimeout } from '@/lib/withTimeout';
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

export type OnlineExerciseSuggestion = {
  name: string;
  slug: string;
  equipment: string;
  muscleGroups: string[];
  exerciseType: 'strength' | 'bodyweight' | 'timed' | 'cardio';
  reason: string;
  source: 'ai' | 'web';
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

  async searchExercisesOnline(input: {
    query: string;
    limit?: number;
    availableEquipment?: string[];
  }) {
    const query = input.query.trim();
    if (query.length < 2) return ok([] as OnlineExerciseSuggestion[]);

    try {
      const token = await getAccessToken();
      const raw = await withTimeout(
        apiClient.post<{ data: { suggestions: OnlineExerciseSuggestion[] } }>(
          '/api/ai/exercises/search',
          {
            query,
            limit: input.limit ?? 5,
            availableEquipment: input.availableEquipment,
          },
          token,
        ),
        10_000,
        'online exercise search',
      );
      return ok(raw.data?.suggestions ?? []);
    } catch (e) {
      if (__DEV__) {
        console.warn('[exerciseAdvisoryService] online search failed', e);
      }
      return fromError(e);
    }
  },
};

export type ExerciseAdvisoryService = typeof exerciseAdvisoryService;
