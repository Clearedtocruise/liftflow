import { useCallback, useEffect, useState } from 'react';

import { pickDefaultLocation } from '@/constants/trainingProfile';
import { workoutLocationService } from '@/services/workoutLocationService';
import type { WorkoutLocation } from '@/types/workoutLocation';

export function useWorkoutLocations(userId: string | undefined) {
  const [locations, setLocations] = useState<WorkoutLocation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setLocations([]);
      setSelectedId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const result = await workoutLocationService.list(userId);
    if (result.success) {
      setLocations(result.data);
      setSelectedId((prev) => {
        if (prev && result.data.some((l) => l.id === prev)) return prev;
        return pickDefaultLocation(result.data)?.id ?? null;
      });
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selected = pickDefaultLocation(locations, selectedId);

  return {
    locations,
    selected,
    selectedId,
    setSelectedId,
    loading,
    refresh,
  };
};
