import { useCallback, useEffect, useState } from 'react';

import { shouldOfferCustomExercise, validateCustomExerciseName } from '@/lib/customExerciseName';
import { workoutService } from '@/services/workoutService';
import type { Exercise } from '@/types';

type UseExerciseSearchOptions = {
  /** Searching only runs while the surface showing the results is on screen. */
  enabled: boolean;
  userId?: string;
};

/**
 * Catalog search plus "add it anyway" creation, shared by every surface that picks an exercise.
 *
 * It lives in a hook because the replace sheet needs the same search the add picker has — without
 * opening a second modal on top of the first, which iOS refuses to present.
 */
export function useExerciseSearch({ enabled, userId }: UseExerciseSearchOptions) {
  const [query, setQueryState] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !userId) return;

    let cancelled = false;
    setLoading(true);
    void workoutService.searchExercises(query, userId).then((result) => {
      if (cancelled) return;
      if (result.success) setExercises(result.data);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, query, userId]);

  const setQuery = useCallback((text: string) => {
    setQueryState(text);
    setCreateError(null);
  }, []);

  const reset = useCallback(() => {
    setQueryState('');
    setCreateError(null);
  }, []);

  const createCustom = useCallback(async (): Promise<Exercise | null> => {
    if (!userId || creating) return null;

    const check = validateCustomExerciseName(query);
    if (!check.valid) {
      setCreateError(check.reason);
      return null;
    }

    setCreating(true);
    setCreateError(null);
    const result = await workoutService.createCustomExercise(check.name, userId);
    setCreating(false);

    if (!result.success) {
      setCreateError(result.error);
      return null;
    }

    setQueryState('');
    return result.data;
  }, [creating, query, userId]);

  return {
    query,
    setQuery,
    exercises,
    loading,
    creating,
    createError,
    canCreate: !loading && shouldOfferCustomExercise(query, exercises),
    createCustom,
    reset,
  };
}
