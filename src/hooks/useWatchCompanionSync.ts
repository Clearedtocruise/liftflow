import { useEffect, useRef } from 'react';

import { productAnalyticsService } from '@/services/productAnalyticsService';
import { watchCompanionService } from '@/services/watchCompanionService';
import { useWorkoutSession } from '@/state/workout/WorkoutSessionContext';

/** Keeps Apple Watch state in sync with phone workout session + rest timer. */
export function useWatchCompanionSync(userId: string | undefined) {
  const { activeSession, restSecondsRemaining } = useWorkoutSession();
  const watchSyncTracked = useRef(false);

  useEffect(() => {
    if (!userId) return;
    return watchCompanionService.startInboundListener(userId);
  }, [userId]);

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
  }, [userId, activeSession?.id, activeSession?.status, restSecondsRemaining]);

  useEffect(() => {
    if (!userId) return;
    void watchCompanionService.flushOfflineQueue();
  }, [userId]);
}
