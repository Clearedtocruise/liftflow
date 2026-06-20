import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { AppState, Vibration } from 'react-native';

import { DEFAULT_REST_SECONDS } from '@/constants/workout';
import { isStaleWorkoutSession } from '@/lib/staleWorkoutSession';
import { peakMusicService } from '@/services/peakMusicService';
import { workoutService } from '@/services/workoutService';
import type { CreateSetPayload, RestPeriod, StartSessionPayload, UpdateSetPayload, WorkoutSession, WorkoutSet } from '@/types';

type WorkoutSessionState = {
  activeSession: WorkoutSession | null;
  activeExerciseIndex: number;
  activeRestPeriod: RestPeriod | null;
  restSecondsRemaining: number | null;
  isListening: boolean;
  isLoading: boolean;
  lastLoggedSet: WorkoutSet | null;
  /** Reps dictated from Apple Watch — survives tab switches and session refresh. */
  watchDraftReps: number | null;
  /** Weight (kg) dictated from Apple Watch. */
  watchDraftWeightKg: number | null;
};

type WorkoutSessionActions = {
  hydrate: () => Promise<void>;
  refreshSession: () => Promise<void>;
  setActiveExerciseIndex: (index: number) => void;
  startSession: (payload: StartSessionPayload) => Promise<WorkoutSession | null>;
  startSessionFromPlanned: (plannedWorkoutId: string, payload: StartSessionPayload) => Promise<WorkoutSession | null>;
  endSession: () => Promise<WorkoutSession | null>;
  pauseSession: () => Promise<void>;
  resumeSession: () => Promise<void>;
  cancelSession: () => Promise<void>;
  logSet: (payload: CreateSetPayload) => Promise<WorkoutSet | null>;
  updateSet: (setId: string, payload: UpdateSetPayload) => Promise<WorkoutSet | null>;
  deleteSet: (setId: string) => Promise<boolean>;
  addExerciseByName: (name: string) => Promise<string | null>;
  setListening: (listening: boolean) => void;
  startRestTimer: (setId: string, seconds?: number) => Promise<void>;
  adjustRestTimer: (deltaSeconds: number) => void;
  setRestTimer: (seconds: number) => void;
  pauseRestTimer: () => void;
  resumeRestTimer: () => void;
  skipRestTimer: () => Promise<void>;
  endRestTimer: () => Promise<void>;
  setWatchDraftReps: (reps: number | null) => void;
  setWatchDraftWeightKg: (weightKg: number | null) => void;
};

type WorkoutSessionContextValue = WorkoutSessionState & WorkoutSessionActions;

const WorkoutSessionContext = createContext<WorkoutSessionContextValue | null>(null);

export function WorkoutSessionProvider({
  children,
  userId,
  restTimerHaptics = true,
}: {
  children: ReactNode;
  userId?: string;
  restTimerHaptics?: boolean;
}) {
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [activeRestPeriod, setActiveRestPeriod] = useState<RestPeriod | null>(null);
  const [restSecondsRemaining, setRestSecondsRemaining] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastLoggedSet, setLastLoggedSet] = useState<WorkoutSet | null>(null);
  const [watchDraftReps, setWatchDraftReps] = useState<number | null>(null);
  const [watchDraftWeightKg, setWatchDraftWeightKg] = useState<number | null>(null);
  const restEndAtRef = useRef<number | null>(null);
  const hapticFiredRef = useRef(false);
  const pausedRemainingRef = useRef<number | null>(null);
  /** Bumped on cancel/end/start so in-flight hydrates cannot restore stale sessions. */
  const sessionEpochRef = useRef(0);
  const trackedSessionIdRef = useRef<string | null>(null);
  const dismissedSessionIdsRef = useRef<Set<string>>(new Set());
  const clearLocalSessionState = useCallback(() => {
    trackedSessionIdRef.current = null;
    setActiveSession(null);
    setActiveRestPeriod(null);
    setRestSecondsRemaining(null);
    setWatchDraftReps(null);
    setWatchDraftWeightKg(null);
    restEndAtRef.current = null;
    pausedRemainingRef.current = null;
  }, []);

  const refreshSession = useCallback(async () => {
    const sessionId = trackedSessionIdRef.current;
    if (!sessionId) return;
    const epoch = sessionEpochRef.current;
    const result = await workoutService.getSession(sessionId);
    if (epoch !== sessionEpochRef.current || trackedSessionIdRef.current !== sessionId) return;
    if (!result.success) return;
    if (result.data.status === 'cancelled' || result.data.status === 'completed') {
      trackedSessionIdRef.current = null;
      setActiveSession(null);
      return;
    }
    setActiveSession(result.data);
  }, []);

  const hydrate = useCallback(async () => {
    if (!userId) {
      clearLocalSessionState();
      setIsLoading(false);
      return;
    }
    const epoch = sessionEpochRef.current;
    setIsLoading(true);
    try {
      const result = await workoutService.getActiveSession(userId);
      if (epoch !== sessionEpochRef.current) return;

      if (result.success && result.data && dismissedSessionIdsRef.current.has(result.data.id)) {
        await workoutService.cancelSession(result.data.id);
        clearLocalSessionState();
        return;
      }

      if (result.success && result.data && isStaleWorkoutSession(result.data.startedAt)) {
        dismissedSessionIdsRef.current.add(result.data.id);
        await workoutService.cancelSession(result.data.id);
        clearLocalSessionState();
      } else if (result.success && result.data) {
        trackedSessionIdRef.current = result.data.id;
        setActiveSession(result.data);
      } else if (result.success) {
        clearLocalSessionState();
      }
    } catch (error) {
      console.warn('[workoutSession] hydrate failed', error);
    } finally {
      if (epoch === sessionEpochRef.current) {
        setIsLoading(false);
      }
    }
  }, [clearLocalSessionState, userId]);

  useEffect(() => {
    setActiveExerciseIndex(0);
  }, [activeSession?.id]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;

      if (restEndAtRef.current != null) {
        const remaining = Math.max(0, Math.ceil((restEndAtRef.current - Date.now()) / 1000));
        setRestSecondsRemaining(remaining);
      }

      if (activeSession?.id) {
        void refreshSession();
      }
    });

    return () => subscription.remove();
  }, [activeSession?.id, refreshSession]);

  useEffect(() => {
    if (restSecondsRemaining === null || restSecondsRemaining > 0) return;

    if (restTimerHaptics && !hapticFiredRef.current) {
      Vibration.vibrate([0, 200, 100, 200]);
      hapticFiredRef.current = true;
    }

    const finish = async () => {
      if (!activeRestPeriod) return;
      const recommended = activeRestPeriod.recommendedSeconds ?? DEFAULT_REST_SECONDS;
      await workoutService.endRestTimer(activeRestPeriod.id, recommended, false);
      setActiveRestPeriod(null);
      setRestSecondsRemaining(null);
      restEndAtRef.current = null;
    };

    finish();
  }, [restSecondsRemaining, activeRestPeriod, restTimerHaptics]);

  useEffect(() => {
    if (restSecondsRemaining === null) return;

    const tick = setInterval(() => {
      if (restEndAtRef.current === null) return;
      const remaining = Math.max(0, Math.ceil((restEndAtRef.current - Date.now()) / 1000));
      setRestSecondsRemaining(remaining);
    }, 250);

    return () => clearInterval(tick);
  }, [restSecondsRemaining !== null]);

  const startSession = useCallback(
    async (payload: StartSessionPayload) => {
      if (!userId) return null;
      setIsLoading(true);
      const result = await workoutService.startSession(userId, payload);
      setIsLoading(false);
      if (result.success) {
        sessionEpochRef.current += 1;
        trackedSessionIdRef.current = result.data.id;
        setActiveSession(result.data);
        return result.data;
      }
      return null;
    },
    [userId],
  );

  const startSessionFromPlanned = useCallback(
    async (plannedWorkoutId: string, payload: StartSessionPayload) => {
      if (!userId) return null;
      setIsLoading(true);
      const result = await workoutService.startSessionFromPlanned(userId, plannedWorkoutId, payload);
      setIsLoading(false);
      if (result.success) {
        sessionEpochRef.current += 1;
        trackedSessionIdRef.current = result.data.id;
        setActiveSession(result.data);
        return result.data;
      }
      return null;
    },
    [userId],
  );

  const endSession = useCallback(async () => {
    if (!activeSession) return null;
    const sessionId = activeSession.id;
    sessionEpochRef.current += 1;
    clearLocalSessionState();
    setIsLoading(true);
    const result = await workoutService.endSession(sessionId);
    setIsLoading(false);
    if (result.success) {
      return result.data;
    }
    return null;
  }, [activeSession, clearLocalSessionState]);

  const pauseSession = useCallback(async () => {
    if (!activeSession) return;
    const result = await workoutService.pauseSession(activeSession.id);
    if (result.success) setActiveSession(result.data);
  }, [activeSession]);

  const resumeSession = useCallback(async () => {
    if (!activeSession) return;
    const result = await workoutService.resumeSession(activeSession.id);
    if (result.success) setActiveSession(result.data);
  }, [activeSession]);

  const cancelSession = useCallback(async () => {
    if (!activeSession) return;
    const sessionId = activeSession.id;
    dismissedSessionIdsRef.current.add(sessionId);
    sessionEpochRef.current += 1;
    clearLocalSessionState();

    const result = await workoutService.cancelSession(sessionId);
    if (!result.success) {
      console.warn('[workoutSession] cancel failed', result.error);
    }
  }, [activeSession, clearLocalSessionState]);

  const logSet = useCallback(
    async (payload: CreateSetPayload) => {
      const result = await workoutService.logSet(payload);
      if (!result.success) return null;

      setLastLoggedSet(result.data);
      await refreshSession();

      if (activeSession?.status === 'active' && !payload.skipRest) {
        const restSeconds = payload.restSeconds ?? DEFAULT_REST_SECONDS;
        const restResult = await workoutService.startRestTimer(
          activeSession.id,
          result.data.id,
          restSeconds,
        );
        if (restResult.success) {
          hapticFiredRef.current = false;
          setActiveRestPeriod(restResult.data);
          const seconds = restResult.data.recommendedSeconds ?? DEFAULT_REST_SECONDS;
          restEndAtRef.current = Date.now() + seconds * 1000;
          setRestSecondsRemaining(seconds);
          if (userId) {
            void peakMusicService.triggerRestPeakSync(userId, seconds * 1000, {
              isHeavySet: result.data.weight != null && result.data.weight >= 100,
              isPrAttempt: result.data.isPr === true || result.data.type === 'failure',
            });
          }
        }
      }

      return result.data;
    },
    [activeSession, refreshSession, userId],
  );

  const updateSet = useCallback(
    async (setId: string, payload: UpdateSetPayload) => {
      const result = await workoutService.updateSet(setId, payload);
      if (!result.success) return null;
      await refreshSession();
      return result.data;
    },
    [refreshSession],
  );

  const deleteSet = useCallback(
    async (setId: string) => {
      const result = await workoutService.deleteSet(setId);
      if (!result.success) return false;
      await refreshSession();
      return true;
    },
    [refreshSession],
  );

  const addExerciseByName = useCallback(
    async (name: string) => {
      if (!userId || !activeSession) return null;

      const exerciseIdResult = await workoutService.findOrCreateExerciseByName(name, userId);
      if (!exerciseIdResult.success) return null;

      const existing = activeSession.exercises.find((e) => e.exerciseId === exerciseIdResult.data);
      if (existing) return existing.id;

      const addResult = await workoutService.addExercise(activeSession.id, exerciseIdResult.data);
      if (!addResult.success) return null;

      await refreshSession();
      return addResult.data.id;
    },
    [userId, activeSession, refreshSession],
  );

  const startRestTimer = useCallback(
    async (setId: string, seconds = DEFAULT_REST_SECONDS) => {
      if (!activeSession) return;
      const result = await workoutService.startRestTimer(activeSession.id, setId, seconds);
      if (result.success) {
        hapticFiredRef.current = false;
        setActiveRestPeriod(result.data);
        restEndAtRef.current = Date.now() + seconds * 1000;
        setRestSecondsRemaining(seconds);
        if (userId) {
          void peakMusicService.triggerRestPeakSync(userId, seconds * 1000, {
            isHeavySet: lastLoggedSet?.weight != null && lastLoggedSet.weight >= 100,
            isPrAttempt: lastLoggedSet?.isPr === true || lastLoggedSet?.type === 'failure',
          });
        }
      }
    },
    [activeSession, userId, lastLoggedSet],
  );

  const adjustRestTimer = useCallback((deltaSeconds: number) => {
    if (restEndAtRef.current === null && pausedRemainingRef.current != null) {
      pausedRemainingRef.current = Math.max(0, pausedRemainingRef.current + deltaSeconds);
      setRestSecondsRemaining(pausedRemainingRef.current);
      return;
    }
    if (restEndAtRef.current === null) return;
    restEndAtRef.current += deltaSeconds * 1000;
    const remaining = Math.max(0, Math.ceil((restEndAtRef.current - Date.now()) / 1000));
    setRestSecondsRemaining(remaining);
  }, []);

  const setRestTimer = useCallback((seconds: number) => {
    const next = Math.max(0, seconds);
    pausedRemainingRef.current = next;
    restEndAtRef.current = Date.now() + next * 1000;
    setRestSecondsRemaining(next);
  }, []);

  const pauseRestTimer = useCallback(() => {
    if (restEndAtRef.current === null) return;
    pausedRemainingRef.current = Math.max(0, Math.ceil((restEndAtRef.current - Date.now()) / 1000));
    restEndAtRef.current = null;
    setRestSecondsRemaining(pausedRemainingRef.current);
  }, []);

  const resumeRestTimer = useCallback(() => {
    if (pausedRemainingRef.current == null) return;
    restEndAtRef.current = Date.now() + pausedRemainingRef.current * 1000;
    pausedRemainingRef.current = null;
  }, []);

  const skipRestTimer = useCallback(async () => {
    if (!activeRestPeriod) return;
    const elapsed = Math.floor((Date.now() - new Date(activeRestPeriod.startedAt).getTime()) / 1000);
    await workoutService.endRestTimer(activeRestPeriod.id, elapsed, true);
    if (userId) void peakMusicService.onSetCompleted(userId);
    setActiveRestPeriod(null);
    setRestSecondsRemaining(null);
    restEndAtRef.current = null;
    pausedRemainingRef.current = null;
  }, [activeRestPeriod, userId]);

  const endRestTimer = useCallback(async () => {
    if (!activeRestPeriod) return;
    const elapsed = Math.floor((Date.now() - new Date(activeRestPeriod.startedAt).getTime()) / 1000);
    await workoutService.endRestTimer(activeRestPeriod.id, elapsed, false);
    if (userId) void peakMusicService.onSetCompleted(userId);
    setActiveRestPeriod(null);
    setRestSecondsRemaining(null);
    restEndAtRef.current = null;
    pausedRemainingRef.current = null;
  }, [activeRestPeriod, userId]);

  const value = useMemo<WorkoutSessionContextValue>(
    () => ({
      activeSession,
      activeExerciseIndex,
      activeRestPeriod,
      restSecondsRemaining,
      isListening,
      isLoading,
      lastLoggedSet,
      watchDraftReps,
      watchDraftWeightKg,
      hydrate,
      refreshSession,
      setActiveExerciseIndex,
      startSession,
      startSessionFromPlanned,
      endSession,
      pauseSession,
      resumeSession,
      cancelSession,
      logSet,
      updateSet,
      deleteSet,
      addExerciseByName,
      setListening: setIsListening,
      startRestTimer,
      adjustRestTimer,
      setRestTimer,
      pauseRestTimer,
      resumeRestTimer,
      skipRestTimer,
      endRestTimer,
      setWatchDraftReps,
      setWatchDraftWeightKg,
    }),
    [
      activeSession,
      activeExerciseIndex,
      activeRestPeriod,
      restSecondsRemaining,
      isListening,
      isLoading,
      lastLoggedSet,
      watchDraftReps,
      watchDraftWeightKg,
      hydrate,
      refreshSession,
      setActiveExerciseIndex,
      startSession,
      startSessionFromPlanned,
      endSession,
      pauseSession,
      resumeSession,
      cancelSession,
      logSet,
      updateSet,
      deleteSet,
      addExerciseByName,
      startRestTimer,
      adjustRestTimer,
      setRestTimer,
      pauseRestTimer,
      resumeRestTimer,
      skipRestTimer,
      endRestTimer,
    ],
  );

  return <WorkoutSessionContext.Provider value={value}>{children}</WorkoutSessionContext.Provider>;
}

export function useWorkoutSession(): WorkoutSessionContextValue {
  const ctx = useContext(WorkoutSessionContext);
  if (!ctx) throw new Error('useWorkoutSession must be used within WorkoutSessionProvider');
  return ctx;
}
