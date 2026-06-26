import { useEffect, useRef } from 'react';

import type { CircuitTimerState, IntervalTimerState } from '@/lib/timerEngine';
import { resolveWatchRestSnapshot, type WatchRestSnapshot } from '@/lib/watchRestSync';
import { watchCompanionService } from '@/services/watchCompanionService';
import { watchPhoneBridge } from '@/state/WatchPhoneBridge';

type UseWatchExecutionRestSyncParams = {
  userId?: string;
  restTimerHaptics: boolean;
  traditionalRestSeconds: number | null;
  usesTraditionalRest: boolean;
  intervalTimer: IntervalTimerState | null;
  circuitTimer: CircuitTimerState | null;
};

/** Sync tabata/circuit/traditional rest countdowns to Apple Watch + haptic on rest end. */
export function useWatchExecutionRestSync({
  userId,
  restTimerHaptics,
  traditionalRestSeconds,
  usesTraditionalRest,
  intervalTimer,
  circuitTimer,
}: UseWatchExecutionRestSyncParams) {
  const previousSnapshotRef = useRef<WatchRestSnapshot>({ seconds: null, source: null });
  const suppressWatchRestCompleteRef = useRef(false);

  useEffect(() => {
    if (!userId) return;

    const snapshot = resolveWatchRestSnapshot({
      traditionalSeconds: traditionalRestSeconds,
      usesTraditionalRest,
      intervalTimer,
      circuitTimer,
    });

    const previous = previousSnapshotRef.current;
    const wasResting = (previous.seconds ?? 0) > 0;
    const isResting = (snapshot.seconds ?? 0) > 0;

    watchPhoneBridge.setExecutionRestOverride(
      snapshot.source === 'interval' || snapshot.source === 'circuit' ? snapshot.seconds : null,
    );

    const effectiveSeconds = watchPhoneBridge.getEffectiveRestSecondsRemaining();
    void watchCompanionService.pushRestTimerOnly(userId, effectiveSeconds);

    if (
      wasResting &&
      !isResting &&
      restTimerHaptics &&
      !suppressWatchRestCompleteRef.current &&
      previous.source !== 'traditional'
    ) {
      void watchCompanionService.notifyWatchRestComplete(userId);
    }

    suppressWatchRestCompleteRef.current = false;
    previousSnapshotRef.current = snapshot;
  }, [
    userId,
    restTimerHaptics,
    traditionalRestSeconds,
    usesTraditionalRest,
    intervalTimer,
    circuitTimer,
  ]);

  return {
    suppressNextWatchRestComplete: () => {
      suppressWatchRestCompleteRef.current = true;
    },
  };
}
