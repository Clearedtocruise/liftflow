import { useEffect, useMemo, useRef } from 'react';

import { productAnalyticsService } from '@/services/productAnalyticsService';
import { watchCompanionService } from '@/services/watchCompanionService';
import { useWorkoutSession } from '@/state/workout/WorkoutSessionContext';

/** Keeps Apple Watch state in sync with phone workout session + rest timer. */
export function useWatchCompanionSync(userId: string | undefined) {
  const { activeSession, restSecondsRemaining, hydrate } = useWorkoutSession();
  const watchSyncTracked = useRef(false);

  const sessionSyncKey = useMemo(() => {
    if (!activeSession) return 'none';
    const activeExercise = activeSession.exercises.find((e) => e.isActive) ?? activeSession.exercises[0];
    const setCount = activeSession.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
    return `${activeSession.id}:${activeSession.status}:${activeExercise?.id ?? 'none'}:${setCount}`;
  }, [activeSession]);

  useEffect(() => {
    if (!userId) return;
    return watchCompanionService.startInboundListener(userId, () => {
      void hydrate();
    });
  }, [userId, hydrate]);

  useEffect(() => {
    if (!userId) return;
    void watchCompanionService.pushPhoneWorkoutState(userId, {
      session: activeSession,
      restSecondsRemaining,
    });
    if (activeSession && !watchSyncTracked.current) {
      watchSyncTracked.current = true;
      void productAnalyticsService.trackWatchSync(userId);
    }
  }, [userId, sessionSyncKey, restSecondsRemaining, activeSession]);

  useEffect(() => {
    if (!userId) return;
    void watchCompanionService.flushOfflineQueue();
  }, [userId]);
}
