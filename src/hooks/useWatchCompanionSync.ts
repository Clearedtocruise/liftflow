import { useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';

import { productAnalyticsService } from '@/services/productAnalyticsService';
import { watchCompanionService } from '@/services/watchCompanionService';
import { useWorkoutSession } from '@/state/workout/WorkoutSessionContext';

/** Keeps Apple Watch state in sync with phone workout session + rest timer. */
export function useWatchCompanionSync(userId: string | undefined) {
  const { activeSession, activeExerciseIndex, restSecondsRemaining, hydrate } = useWorkoutSession();
  const watchSyncTracked = useRef(false);

  const sessionSyncKey = useMemo(() => {
    if (!activeSession) return 'none';
    const sorted = [...activeSession.exercises].sort((a, b) => a.sortOrder - b.sortOrder);
    const activeExercise = sorted[activeExerciseIndex] ?? sorted[0];
    const setCount = activeSession.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
    return `${activeSession.id}:${activeSession.status}:${activeExercise?.id ?? 'none'}:${setCount}:${activeExerciseIndex}`;
  }, [activeSession, activeExerciseIndex]);

  const pushState = () => {
    if (!userId) return;
    void watchCompanionService.pushPhoneWorkoutState(userId, {
      session: activeSession,
      restSecondsRemaining,
      activeExerciseIndex,
    });
  };

  useEffect(() => {
    if (!userId) return;
    return watchCompanionService.startInboundListener(userId, () => {
      void hydrate();
    });
  }, [userId, hydrate]);

  useEffect(() => {
    pushState();
    if (activeSession && !watchSyncTracked.current) {
      watchSyncTracked.current = true;
      void productAnalyticsService.trackWatchSync(userId!);
    }
  }, [userId, sessionSyncKey, restSecondsRemaining, activeSession, activeExerciseIndex]);

  useEffect(() => {
    if (!userId) return;
    void watchCompanionService.flushOfflineQueue();
  }, [userId]);

  useEffect(() => {
    if (!userId || !activeSession) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') pushState();
    });
    return () => subscription.remove();
  }, [userId, activeSession?.id, sessionSyncKey, restSecondsRemaining, activeExerciseIndex]);

  useEffect(() => {
    if (!userId || !activeSession) return;
    const interval = setInterval(pushState, 8000);
    return () => clearInterval(interval);
  }, [userId, activeSession?.id, sessionSyncKey, restSecondsRemaining, activeExerciseIndex]);
}
