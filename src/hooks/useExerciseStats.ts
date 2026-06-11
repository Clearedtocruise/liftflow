import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { getExerciseStats, type ExerciseStats } from '@/services/exerciseStatsService';
import type { ExerciseMetric } from '@/types/exerciseCard';

type UseExerciseStatsArgs = {
  exerciseId?: string;
  slug?: string;
  name?: string;
  metric?: ExerciseMetric;
};

export function useExerciseStats({ exerciseId, slug, name, metric }: UseExerciseStatsArgs) {
  const { user } = useAuth();
  const [stats, setStats] = useState<ExerciseStats | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setStats(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await getExerciseStats(user.id, { exerciseId, slug, name, metric });
      setStats(result);
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id, exerciseId, slug, name, metric]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { stats, loading, refresh };
}
