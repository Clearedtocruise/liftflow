import { useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';

import { resolveWatchSetPayload } from '@/lib/watchLogSet';
import { productAnalyticsService } from '@/services/productAnalyticsService';
import { watchCompanionService } from '@/services/watchCompanionService';
import { watchPhoneBridge } from '@/state/WatchPhoneBridge';
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
    logSet,
    setWatchDraftReps,
    setWatchDraftWeightKg,
  } = useWorkoutSession();
  const watchSyncTracked = useRef(false);
  const exerciseIndexRef = useRef(activeExerciseIndex);
  const restSecondsRef = useRef(restSecondsRemaining);
  // The fallback is registered once for the app session, so it must read live state through refs.
  const sessionRef = useRef(activeSession);
  const loggingRef = useRef(false);

  sessionRef.current = activeSession;
  const pushedRestRef = useRef<{ sessionId: string | null; seconds: number | null }>({
    sessionId: null,
    seconds: null,
  });

  exerciseIndexRef.current = activeExerciseIndex;
  restSecondsRef.current = restSecondsRemaining;

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

  /**
   * Logging from the wrist while the phone sits on any other screen. ActiveWorkoutScreen's own
   * handler takes precedence whenever it is mounted.
   */
  useEffect(() => {
    if (!userId) {
      watchPhoneBridge.setFallbackLogSetHandler(null);
      return;
    }

    watchPhoneBridge.setFallbackLogSetHandler(async () => {
      // A second wrist tap during the round trip would log the same set twice.
      if (loggingRef.current) {
        return { ok: false as const, error: 'A set is already being logged.' };
      }

      const resolution = resolveWatchSetPayload({
        session: sessionRef.current,
        activeExerciseIndex: exerciseIndexRef.current,
        draftReps: watchPhoneBridge.getPendingWatchReps(),
        draftWeightKg: watchPhoneBridge.getPendingWatchWeightKg(),
      });
      if (!resolution.ok) return { ok: false as const, error: resolution.error };

      loggingRef.current = true;
      try {
        const saved = await logSet(resolution.payload);
        if (!saved) return { ok: false as const, error: 'Could not log that set.' };

        // The drafts have been spent; leaving them would repeat on the next wrist tap.
        watchPhoneBridge.clearPendingWatchReps();
        watchPhoneBridge.clearPendingWatchWeightKg();
        setWatchDraftReps(null);
        setWatchDraftWeightKg(null);
        return { ok: true as const };
      } finally {
        loggingRef.current = false;
      }
    });

    return () => watchPhoneBridge.setFallbackLogSetHandler(null);
  }, [userId, logSet, setWatchDraftReps, setWatchDraftWeightKg]);

  const pushFullState = () => {
    if (!userId) return;
    void watchCompanionService.pushPhoneWorkoutState(userId, {
      session: activeSession,
      restSecondsRemaining,
      activeExerciseIndex,
      forceClear: !activeSession,
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
    pushFullState();
    if (activeSession && !watchSyncTracked.current) {
      watchSyncTracked.current = true;
      void productAnalyticsService.trackWatchSync(userId!);
    }
  }, [userId, sessionStructureKey, activeSession]);

  /**
   * The watch runs its own countdown once armed, so it only needs the deadline — not every tick.
   * Transmitting each second flooded the WatchConnectivity queue and kept re-arming that countdown.
   */
  useEffect(() => {
    if (!userId || !activeSession) return;

    const previous =
      pushedRestRef.current.sessionId === activeSession.id ? pushedRestRef.current.seconds : null;
    pushedRestRef.current = { sessionId: activeSession.id, seconds: restSecondsRemaining };

    const previousRest = previous != null && previous > 0 ? previous : 0;
    const currentRest = restSecondsRemaining != null && restSecondsRemaining > 0 ? restSecondsRemaining : 0;

    // A tick moves the value down by exactly one second; anything else is a new or cleared deadline.
    const isTick = previousRest > 0 && currentRest > 0 && previousRest - currentRest === 1;
    const transmit = previousRest !== currentRest && !isTick;

    void watchCompanionService.pushRestTimerOnly(userId, restSecondsRemaining, { transmit });
  }, [userId, activeSession?.id, restSecondsRemaining]);

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
  }, [userId, activeSession?.id, sessionStructureKey]);
};
