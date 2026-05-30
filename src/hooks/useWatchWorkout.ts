import { useCallback, useEffect, useState } from 'react';

import type { WatchWorkoutAssistantState } from '@/integrations/watch';
import { listSupportedExerciseNames } from '@/integrations/watch';
import { pushWorkoutStateToWatch } from '@/integrations/watchSyncBridge';
import { watchWorkoutService } from '@/services/watchWorkoutService';

export function useWatchWorkout(userId: string | undefined) {
  const [state, setState] = useState<WatchWorkoutAssistantState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    const result = await watchWorkoutService.syncActiveSession(userId);
    setLoading(false);
    if (result.success) {
      setState(result.data);
      await pushWorkoutStateToWatch(result.data);
    } else {
      setError(result.error);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const simulateRep = useCallback(async () => {
    if (!userId) return;
    const result = await watchWorkoutService.simulateRep(userId);
    if (result.success) {
      setState(result.data.state);
      if (result.data.spoken) watchWorkoutService.speak(result.data.spoken);
      await pushWorkoutStateToWatch(result.data.state);
    } else {
      setError(result.error);
    }
  }, [userId]);

  const correctReps = useCallback(
    async (count: number) => {
      if (!userId) return;
      const result = await watchWorkoutService.correctReps(userId, count);
      if (result.success) {
        setState(result.data);
        watchWorkoutService.speak(`Rep count set to ${count}.`);
        await pushWorkoutStateToWatch(result.data);
      } else setError(result.error);
    },
    [userId],
  );

  const confirmReps = useCallback(async () => {
    if (!userId) return;
    const result = await watchWorkoutService.confirmReps(userId);
    if (result.success) {
      setState(result.data);
      await pushWorkoutStateToWatch(result.data);
    } else setError(result.error);
  }, [userId]);

  const handleVoice = useCallback(
    async (transcript: string) => {
      if (!userId) return;
      const result = await watchWorkoutService.handleVoice(userId, transcript);
      if (result.success) {
        setState(result.data.state);
        watchWorkoutService.speak(result.data.spokenResponse);
        await pushWorkoutStateToWatch(result.data.state);
      } else setError(result.error);
    },
    [userId],
  );

  const completeSet = useCallback(async () => {
    if (!userId) return;
    const result = await watchWorkoutService.completeSet(userId);
    if (result.success) {
      setState(result.data.state);
      watchWorkoutService.speak('Set logged. Rest started.');
      await pushWorkoutStateToWatch(result.data.state);
    } else setError(result.error);
  }, [userId]);

  return {
    state,
    loading,
    error,
    supportedExercises: listSupportedExerciseNames(),
    refresh,
    simulateRep,
    correctReps,
    confirmReps,
    handleVoice,
    completeSet,
  };
}
