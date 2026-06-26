import { useEffect, useRef, useState } from 'react';

import type { WatchCardioState } from '@/integrations/watch/types';
import { pushCardioStateToWatch } from '@/integrations/watchSyncBridge';
import { watchCardioBridge } from '@/state/watchCardioBridge';

type CardioSyncInput = {
  sessionId: string;
  activityLabel: string;
  activityType: string;
  running: boolean;
  elapsedSeconds: number;
  sessionStartedAt?: string;
  distanceMeters?: number;
  paceLabel?: string | null;
  speedLabel?: string | null;
  calories?: number;
  phaseLabel?: string;
  enabled?: boolean;
};

/** Mirrors live cardio metrics to Apple Watch and receives HR samples from the watch. */
export function useWatchCardioSync(input: CardioSyncInput) {
  const [heartRateBpm, setHeartRateBpm] = useState<number | undefined>();
  const heartRateRef = useRef<number | undefined>(undefined);
  const presentedWorkoutRef = useRef(false);
  const {
    sessionId,
    activityLabel,
    activityType,
    running,
    elapsedSeconds,
    sessionStartedAt,
    distanceMeters,
    paceLabel,
    speedLabel,
    calories,
    phaseLabel,
    enabled = true,
  } = input;

  useEffect(() => {
    if (!enabled) return;
    return watchCardioBridge.subscribeHeartRate((bpm) => {
      heartRateRef.current = bpm;
      setHeartRateBpm(bpm);
    });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      presentedWorkoutRef.current = false;
      watchCardioBridge.setActive(null);
      void pushCardioStateToWatch(null);
      return;
    }

    const state: WatchCardioState = {
      sessionId,
      activityLabel,
      activityType,
      running,
      elapsedSeconds,
      sessionStartedAt,
      distanceMeters,
      paceLabel,
      speedLabel,
      calories,
      phaseLabel,
      heartRateBpm: heartRateRef.current,
      updatedAt: new Date().toISOString(),
    };

    watchCardioBridge.setActive(state);

    const shouldPresent = !presentedWorkoutRef.current && running;
    if (shouldPresent) {
      presentedWorkoutRef.current = true;
    }

    void pushCardioStateToWatch(state, { presentWorkout: shouldPresent });
  }, [
    enabled,
    sessionId,
    activityLabel,
    activityType,
    running,
    elapsedSeconds,
    sessionStartedAt,
    distanceMeters,
    paceLabel,
    speedLabel,
    calories,
    phaseLabel,
  ]);

  useEffect(() => {
    if (!enabled) return;
    return () => {
      presentedWorkoutRef.current = false;
      watchCardioBridge.setActive(null);
      void pushCardioStateToWatch(null);
    };
  }, [enabled, sessionId]);

  return { heartRateBpm };
}
