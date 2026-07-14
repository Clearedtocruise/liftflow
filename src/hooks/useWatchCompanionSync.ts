import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { productAnalyticsService } from '@/services/productAnalyticsService';
import { watchCompanionService } from '@/services/watchCompanionService';
import { watchPhoneBridge } from '@/state/WatchPhoneBridge';
import { watchCardioBridge } from '@/state/watchCardioBridge';
import { useWorkoutSession } from '@/state/workout/WorkoutSessionContext';

const WATCH_COMMANDS_WITHOUT_SESSION_REFRESH = new Set([
  'voice_command',
  'request_sync',
  'skip_rest',
  'log_set',
  'set_weight',
]);

/** Keeps Apple Watch state in sync with phone workout session + rest timer. */
export function useWatchCompanionSync(userId: string | undefined) {
  const {
    activeSession,
    activeExerciseIndex,
    restSecondsRemaining,
    skipRestTimer,
    refreshSession,
    cancelSession,
    setWatchDraftReps,
    setWatchDraftWeightKg,
  } = useWorkoutSession();
  const watchSyncTracked = useRef(false);
  const exerciseIndexRef = useRef(activeExerciseIndex);
  const restSecondsRef = useRef(restSecondsRemaining);
  const [cardioWatchEpoch, setCardioWatchEpoch] = useState(0);

  exerciseIndexRef.current = activeExerciseIndex;
  restSecondsRef.current = restSecondsRemaining;

  useEffect(() => {
    return watchCardioBridge.subscribeActive(() => {
      setCardioWatchEpoch((epoch) => epoch + 1);
    });
  }, []);

  const sessionStructureKey = useMemo(() => {
    if (!activeSession) return 'none';
    const sorted = [...activeSession.exercises].sort((a, b) => a.sortOrder - b.sortOrder);
    const activeExercise = sorted[activeExerciseIndex] ?? sorted[0];
    const setCount = activeSession.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
    return `${activeSession.id}:${activeSession.status}:${activeExercise?.id ?? 'none'}:${setCount}:${activeExerciseIndex}`;
  }, [activeSession, activeExerciseIndex]);

  useEffect(() => {
    if (!userId) {
      watchPhoneBridge.setSessionHandlers(null);
      watchPhoneBridge.setRepsHandler(null);
      watchPhoneBridge.setWeightKgHandler(null);
      return;
    }
    watchPhoneBridge.setSessionHandlers({
      skipRest: skipRestTimer,
      cancelWorkout: cancelSession,
      getExerciseIndex: () => exerciseIndexRef.current,
      getRestSecondsRemaining: () => restSecondsRef.current,
    });
    watchPhoneBridge.setRepsHandler((nextReps) => {
      setWatchDraftReps(nextReps);
    });
    watchPhoneBridge.setWeightKgHandler((weightKg) => {
      setWatchDraftWeightKg(weightKg);
    });
    return () => {
      watchPhoneBridge.setSessionHandlers(null);
      watchPhoneBridge.setRepsHandler(null);
      watchPhoneBridge.setWeightKgHandler(null);
    };
  }, [userId, skipRestTimer, cancelSession, setWatchDraftReps, setWatchDraftWeightKg]);

  const pushFullState = () => {
    if (!userId || watchCardioBridge.isWatchOwnedByCardio()) return;
    if (!activeSession) {
      void watchCompanionService.notifyWatchSessionEnded(userId);
      return;
    }
    void watchCompanionService.pushPhoneWorkoutState(userId, {
      session: activeSession,
      restSecondsRemaining,
      activeExerciseIndex,
      forceClear: false,
    });
  };

  useEffect(() => {
    if (!userId) return;
    return watchCompanionService.startInboundListener(userId, (message) => {
      const type = typeof message.type === 'string' ? message.type : '';
      if (WATCH_COMMANDS_WITHOUT_SESSION_REFRESH.has(type)) return;
      if (activeSession?.id) {
        void refreshSession();
      }
    });
  }, [userId, refreshSession, activeSession?.id]);

  useEffect(() => {
    if (!userId) return;
    if (!activeSession) {
      void watchCompanionService.notifyWatchSessionEnded(userId);
      watchSyncTracked.current = false;
      return;
    }
    pushFullState();
    if (!watchSyncTracked.current) {
      watchSyncTracked.current = true;
      void productAnalyticsService.trackWatchSync(userId);
    }
  }, [userId, sessionStructureKey, activeSession, cardioWatchEpoch]);

  useEffect(() => {
    if (!userId || !activeSession || watchCardioBridge.isWatchOwnedByCardio()) return;
    void watchCompanionService.pushRestTimerOnly(userId, watchPhoneBridge.getEffectiveRestSecondsRemaining());
  }, [userId, activeSession?.id, restSecondsRemaining, cardioWatchEpoch]);

  useEffect(() => {
    if (!userId) return;
    void watchCompanionService.flushOfflineQueue();
  }, [userId]);

  useEffect(() => {
    if (!userId || !activeSession) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') pushFullState();
    });
    return () => subscription.remove();
  }, [userId, activeSession?.id, sessionStructureKey, cardioWatchEpoch]);
};
