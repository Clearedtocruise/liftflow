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
import { AppState } from 'react-native';

import { DEFAULT_REST_SECONDS } from '@/constants/workout';
import { pendingSetQueue } from '@/lib/pendingSetQueue';
import {
    applyOptimisticSetToSession,
    clearLocalRestTimerState,
    mergePendingSetsIntoSession,
} from '@/lib/pendingSetSync';
import { cueRestTimerComplete } from '@/lib/restTimerFeedback';
import { isStaleWorkoutSession } from '@/lib/staleWorkoutSession';
import { withTimeout } from '@/lib/withTimeout';
import { clearWorkoutProgress, loadWorkoutProgress, saveWorkoutProgress } from '@/lib/workoutSessionPersistence';
import { peakMusicService } from '@/services/peakMusicService';
import { userService } from '@/services/userService';
import { watchCompanionService } from '@/services/watchCompanionService';
import { workoutService } from '@/services/workoutService';
import { watchPhoneBridge } from '@/state/WatchPhoneBridge';
import type { CreateSetPayload, RestPeriod, StartSessionPayload, UpdateSetPayload, WorkoutSession, WorkoutSet } from '@/types';

type WorkoutSessionState = {
  activeSession: WorkoutSession | null;
  activeExerciseIndex: number;
  activeRestPeriod: RestPeriod | null;
  restSecondsRemaining: number | null;
  restTimerPaused: boolean;
  restTimerHaptics: boolean;
  isListening: boolean;
  isLoading: boolean;
  lastLoggedSet: WorkoutSet | null;
  /** Reps dictated from Apple Watch — survives tab switches and session refresh. */
  watchDraftReps: number | null;
  /** Weight (kg) dictated from Apple Watch. */
  watchDraftWeightKg: number | null;
  /** Per-exercise target sets (plan + manual bonus + coach) for global rest UI. */
  exerciseEffectiveTargetSets: Record<string, number>;
  pendingSetCount: number;
};

type WorkoutSessionActions = {
  hydrate: () => Promise<void>;
  refreshSession: () => Promise<void>;
  setActiveExerciseIndex: (index: number | ((prev: number) => number)) => void;
  startSession: (payload: StartSessionPayload) => Promise<WorkoutSession | null>;
  startSessionFromPlanned: (plannedWorkoutId: string, payload: StartSessionPayload) => Promise<WorkoutSession | null>;
  endSession: () => Promise<WorkoutSession | null>;
  pauseSession: () => Promise<void>;
  resumeSession: () => Promise<void>;
  cancelSession: () => Promise<void>;
  logSet: (payload: CreateSetPayload) => Promise<WorkoutSet | null>;
  updateSet: (setId: string, payload: UpdateSetPayload) => Promise<WorkoutSet | null>;
  deleteSet: (setId: string) => Promise<boolean>;
  addExerciseByName: (
    name: string,
    options?: { afterSortOrder?: number },
  ) => Promise<string | null>;
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
  setExerciseEffectiveTargetSets: (workoutExerciseId: string, targetSets: number) => void;
  flushPendingSets: () => Promise<void>;
};

type WorkoutSessionContextValue = WorkoutSessionState & WorkoutSessionActions;

const WorkoutSessionContext = createContext<WorkoutSessionContextValue | null>(null);

export function WorkoutSessionProvider({
  children,
  userId,
}: {
  children: ReactNode;
  userId?: string;
}) {
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [activeRestPeriod, setActiveRestPeriod] = useState<RestPeriod | null>(null);
  const [restSecondsRemaining, setRestSecondsRemaining] = useState<number | null>(null);
  const [restTimerPaused, setRestTimerPaused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastLoggedSet, setLastLoggedSet] = useState<WorkoutSet | null>(null);
  const [watchDraftReps, setWatchDraftReps] = useState<number | null>(null);
  const [watchDraftWeightKg, setWatchDraftWeightKg] = useState<number | null>(null);
  const [exerciseEffectiveTargetSets, setExerciseEffectiveTargetSetsMap] = useState<Record<string, number>>({});
  const [pendingSetCount, setPendingSetCount] = useState(0);
  const [restTimerSound, setRestTimerSound] = useState(true);
  const [restTimerHaptics, setRestTimerHaptics] = useState(true);
  const restEndAtRef = useRef<number | null>(null);
  const hapticFiredRef = useRef(false);
  const suppressWatchRestCompleteRef = useRef(false);
  const pausedRemainingRef = useRef<number | null>(null);
  /** Bumped on cancel/end/start so in-flight hydrates cannot restore stale sessions. */
  const sessionEpochRef = useRef(0);
  const trackedSessionIdRef = useRef<string | null>(null);
  const dismissedSessionIdsRef = useRef<Set<string>>(new Set());
  const flushInFlightRef = useRef(false);
  const clearLocalSessionState = useCallback(() => {
    trackedSessionIdRef.current = null;
    setActiveSession(null);
    setActiveRestPeriod(null);
    setRestSecondsRemaining(null);
    setRestTimerPaused(false);
    setWatchDraftReps(null);
    setWatchDraftWeightKg(null);
    setExerciseEffectiveTargetSetsMap({});
    setActiveExerciseIndex(0);
    restEndAtRef.current = null;
    pausedRemainingRef.current = null;
    void clearWorkoutProgress();
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

    const pending = (await pendingSetQueue.list()).filter((item) => item.sessionId === sessionId);
    setActiveSession(
      pending.length > 0 ? mergePendingSetsIntoSession(result.data, pending) : result.data,
    );
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
      const result = await withTimeout(
        workoutService.getActiveSession(userId),
        8_000,
        'active session hydrate',
      );
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
        const savedIndex = await loadWorkoutProgress(result.data.id);
        if (savedIndex != null && savedIndex >= 0) {
          setActiveExerciseIndex(savedIndex);
        } else {
          setActiveExerciseIndex(0);
        }
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

  const syncPendingSetCount = useCallback(async (sessionId: string | null) => {
    setPendingSetCount(sessionId ? await pendingSetQueue.countForSession(sessionId) : 0);
  }, []);

  const flushPendingSets = useCallback(async () => {
    const sessionId = trackedSessionIdRef.current;
    if (!sessionId || flushInFlightRef.current) return;

    flushInFlightRef.current = true;
    try {
      const items = (await pendingSetQueue.list()).filter((item) => item.sessionId === sessionId);
      if (items.length === 0) {
        await syncPendingSetCount(sessionId);
        return;
      }

      let synced = 0;
      for (const item of items) {
        const result = await workoutService.logSet(item.payload);
        if (result.success) {
          await pendingSetQueue.remove(item.id);
          synced += 1;
        } else {
          await pendingSetQueue.markAttempt(item.id);
        }
      }

      await syncPendingSetCount(sessionId);
      if (synced > 0 && trackedSessionIdRef.current === sessionId) {
        await refreshSession();
      }
    } finally {
      flushInFlightRef.current = false;
    }
  }, [refreshSession, syncPendingSetCount]);

  useEffect(() => {
    if (!activeSession?.id) {
      void syncPendingSetCount(null);
      return;
    }
    void syncPendingSetCount(activeSession.id);
    void flushPendingSets();
  }, [activeSession?.id, flushPendingSets, syncPendingSetCount]);

  useEffect(() => {
    if (!activeSession?.id) return;
    void saveWorkoutProgress(activeSession.id, activeExerciseIndex);
  }, [activeSession?.id, activeExerciseIndex]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!userId) {
      setRestTimerSound(true);
      setRestTimerHaptics(true);
      return;
    }
    void userService.getPreferences(userId).then((result) => {
      if (!result.success) return;
      setRestTimerSound(result.data.restTimerSound);
      setRestTimerHaptics(result.data.restTimerHaptics);
    });
  }, [userId]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;

      if (restEndAtRef.current != null) {
        const remaining = Math.max(0, Math.ceil((restEndAtRef.current - Date.now()) / 1000));
        setRestSecondsRemaining(remaining);
      }

      if (activeSession?.id) {
        void refreshSession();
        void flushPendingSets();
      }
    });

    return () => subscription.remove();
  }, [activeSession?.id, flushPendingSets, refreshSession]);

  useEffect(() => {
    if (restSecondsRemaining === null || restSecondsRemaining > 0) return;

    if (restTimerHaptics || restTimerSound) {
      if (!hapticFiredRef.current) {
        cueRestTimerComplete({ sound: restTimerSound, haptics: restTimerHaptics });
        hapticFiredRef.current = true;
      }
    }

    if (userId && restTimerHaptics && !suppressWatchRestCompleteRef.current) {
      void watchCompanionService.notifyWatchRestComplete(userId);
    }
    suppressWatchRestCompleteRef.current = false;

    const finish = async () => {
      if (activeRestPeriod) {
        const recommended = activeRestPeriod.recommendedSeconds ?? DEFAULT_REST_SECONDS;
        await workoutService.endRestTimer(activeRestPeriod.id, recommended, false);
      }
      clearLocalRestTimerState({
        setActiveRestPeriod,
        setRestSecondsRemaining,
        setRestTimerPaused,
        restEndAtRef,
        pausedRemainingRef,
      });
    };

    finish();
  }, [restSecondsRemaining, activeRestPeriod, restTimerHaptics, restTimerSound, userId]);

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
        const savedIndex = await loadWorkoutProgress(result.data.id);
        setActiveExerciseIndex(savedIndex ?? 0);
        void watchCompanionService.notifyWatchWorkoutStarted(userId, result.data);
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
        const savedIndex = await loadWorkoutProgress(result.data.id);
        setActiveExerciseIndex(savedIndex ?? 0);
        void watchCompanionService.notifyWatchWorkoutStarted(userId, result.data);
        return result.data;
      }
      return null;
    },
    [userId],
  );

  const endSession = useCallback(async () => {
    if (!activeSession) return null;
    const sessionId = activeSession.id;
    await flushPendingSets();
    dismissedSessionIdsRef.current.add(sessionId);
    sessionEpochRef.current += 1;
    clearLocalSessionState();
    if (userId) {
      void watchCompanionService.notifyWatchSessionEnded(userId, 'Workout complete');
    }
    setIsLoading(true);
    const caloriesBurned = watchPhoneBridge.getLastWatchActiveCalories() ?? undefined;
    const result = await workoutService.endSession(sessionId, { caloriesBurned });
    watchPhoneBridge.setLastWatchActiveCalories(null);
    setIsLoading(false);
    if (result.success) {
      await pendingSetQueue.purgeSession(sessionId);
      await syncPendingSetCount(null);
      if (userId) {
        void watchCompanionService.notifyWatchSessionEnded(userId, 'Workout complete');
      }
      return result.data;
    }
    return null;
  }, [activeSession, clearLocalSessionState, flushPendingSets, syncPendingSetCount, userId]);

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
    if (userId) {
      void watchCompanionService.notifyWatchSessionEnded(userId, 'Workout cancelled');
    }
    await pendingSetQueue.purgeSession(sessionId);
    await syncPendingSetCount(null);

    const result = await workoutService.cancelSession(sessionId);
    if (!result.success) {
      console.warn('[workoutSession] cancel failed', result.error);
    }
  }, [activeSession, clearLocalSessionState, syncPendingSetCount, userId]);

  const logSet = useCallback(
    async (payload: CreateSetPayload) => {
      if (!activeSession) return null;

      const beginLocalRest = (loggedSet: WorkoutSet) => {
        if (activeSession.status !== 'active' || payload.skipRest) return;
        const restSeconds = payload.restSeconds ?? DEFAULT_REST_SECONDS;
        hapticFiredRef.current = false;
        setRestTimerPaused(false);
        setActiveRestPeriod(null);
        restEndAtRef.current = Date.now() + restSeconds * 1000;
        setRestSecondsRemaining(restSeconds);
        if (userId) {
          void peakMusicService.triggerRestPeakSync(userId, restSeconds * 1000, {
            isHeavySet: loggedSet.weight != null && loggedSet.weight >= 100,
            isPrAttempt: loggedSet.isPr === true || loggedSet.type === 'failure',
          });
        }
      };

      // Optimistic-first: unlock UI immediately, sync in the background.
      // Ephemeral id until durable queue is needed on network failure.
      const localPendingId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimistic = applyOptimisticSetToSession(activeSession, payload, localPendingId);
      setActiveSession(optimistic.session);
      setLastLoggedSet(optimistic.set);
      beginLocalRest(optimistic.set);

      void (async () => {
        const result = await workoutService.logSet(payload);
        if (result.success) {
          setLastLoggedSet(result.data);
          setActiveSession((current) => {
            if (!current || current.id !== activeSession.id) return current;
            return {
              ...current,
              exercises: current.exercises.map((exercise) => {
                if (exercise.id !== payload.workoutExerciseId) return exercise;
                return {
                  ...exercise,
                  sets: exercise.sets.map((set) =>
                    set.id === optimistic.set.id ? { ...result.data, pendingSync: false } : set,
                  ),
                };
              }),
            };
          });
          if (activeSession.status === 'active' && !payload.skipRest) {
            void workoutService
              .startRestTimer(
                activeSession.id,
                result.data.id,
                payload.restSeconds ?? DEFAULT_REST_SECONDS,
              )
              .then((restResult) => {
                if (!restResult.success) return;
                setActiveRestPeriod(restResult.data);
              });
          }
          return;
        }

        const pendingId = await pendingSetQueue.enqueue(activeSession.id, payload);
        await syncPendingSetCount(activeSession.id);
        setActiveSession((current) => {
          if (!current || current.id !== activeSession.id) return current;
          return {
            ...current,
            exercises: current.exercises.map((exercise) => {
              if (exercise.id !== payload.workoutExerciseId) return exercise;
              return {
                ...exercise,
                sets: exercise.sets.map((set) =>
                  set.id === optimistic.set.id
                    ? { ...set, id: `pending-${pendingId}`, pendingSync: true }
                    : set,
                ),
              };
            }),
          };
        });
      })();

      return optimistic.set;
    },
    [activeSession, syncPendingSetCount, userId],
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
      if (setId.startsWith('pending-')) {
        const queueId = setId.replace(/^pending-/, '');
        await pendingSetQueue.remove(queueId);
        await syncPendingSetCount(activeSession?.id ?? null);
        if (activeSession) {
          setActiveSession({
            ...activeSession,
            exercises: activeSession.exercises.map((exercise) => ({
              ...exercise,
              sets: exercise.sets.filter((set) => set.id !== setId),
            })),
          });
        }
        setLastLoggedSet((current) => (current?.id === setId ? null : current));
        return true;
      }

      const result = await workoutService.deleteSet(setId);
      if (!result.success) return false;
      setLastLoggedSet((current) => (current?.id === setId ? null : current));
      await refreshSession();
      return true;
    },
    [activeSession, refreshSession, syncPendingSetCount],
  );

  const addExerciseByName = useCallback(
    async (name: string, options?: { afterSortOrder?: number }) => {
      if (!userId || !activeSession) return null;

      const exerciseIdResult = await workoutService.findOrCreateExerciseByName(name, userId);
      if (!exerciseIdResult.success) return null;

      const existing = activeSession.exercises.find((e) => e.exerciseId === exerciseIdResult.data);
      if (existing) return existing.id;

      const insertAt =
        options?.afterSortOrder != null ? options.afterSortOrder + 1 : undefined;
      const addResult = await workoutService.addExercise(
        activeSession.id,
        exerciseIdResult.data,
        insertAt,
      );
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
        setRestTimerPaused(false);
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
    setRestTimerPaused(true);
  }, []);

  const resumeRestTimer = useCallback(() => {
    if (pausedRemainingRef.current == null) return;
    restEndAtRef.current = Date.now() + pausedRemainingRef.current * 1000;
    pausedRemainingRef.current = null;
    setRestTimerPaused(false);
  }, []);

  const skipRestTimer = useCallback(async () => {
    suppressWatchRestCompleteRef.current = true;
    const period = activeRestPeriod;
    // Hit 0 so ActiveWorkoutScreen advance effects run (null alone dismisses UI but
    // never advances). The shared === 0 effect clears local rest state afterward.
    restEndAtRef.current = null;
    pausedRemainingRef.current = null;
    setRestTimerPaused(false);
    setRestSecondsRemaining(0);
    if (period) {
      const elapsed = Math.floor((Date.now() - new Date(period.startedAt).getTime()) / 1000);
      void workoutService.endRestTimer(period.id, elapsed, true);
    }
    if (userId) void peakMusicService.onSetCompleted(userId);
  }, [activeRestPeriod, userId]);

  const setExerciseEffectiveTargetSets = useCallback((workoutExerciseId: string, targetSets: number) => {
    setExerciseEffectiveTargetSetsMap((current) => {
      if (current[workoutExerciseId] === targetSets) return current;
      return { ...current, [workoutExerciseId]: targetSets };
    });
  }, []);

  const endRestTimer = useCallback(async () => {
    if (!activeRestPeriod) return;
    const elapsed = Math.floor((Date.now() - new Date(activeRestPeriod.startedAt).getTime()) / 1000);
    await workoutService.endRestTimer(activeRestPeriod.id, elapsed, false);
    if (userId) void peakMusicService.onSetCompleted(userId);
    setActiveRestPeriod(null);
    setRestSecondsRemaining(null);
    setRestTimerPaused(false);
    restEndAtRef.current = null;
    pausedRemainingRef.current = null;
  }, [activeRestPeriod, userId]);

  const value = useMemo<WorkoutSessionContextValue>(
    () => ({
      activeSession,
      activeExerciseIndex,
      activeRestPeriod,
      restSecondsRemaining,
      restTimerPaused,
      restTimerHaptics,
      isListening,
      isLoading,
      lastLoggedSet,
      watchDraftReps,
      watchDraftWeightKg,
      exerciseEffectiveTargetSets,
      pendingSetCount,
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
      setExerciseEffectiveTargetSets,
      flushPendingSets,
    }),
    [
      activeSession,
      activeExerciseIndex,
      activeRestPeriod,
      restSecondsRemaining,
      restTimerPaused,
      restTimerHaptics,
      isListening,
      isLoading,
      lastLoggedSet,
      watchDraftReps,
      watchDraftWeightKg,
      exerciseEffectiveTargetSets,
      pendingSetCount,
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
      setExerciseEffectiveTargetSets,
      flushPendingSets,
    ],
  );

  return <WorkoutSessionContext.Provider value={value}>{children}</WorkoutSessionContext.Provider>;
}

export function useWorkoutSession(): WorkoutSessionContextValue {
  const ctx = useContext(WorkoutSessionContext);
  if (!ctx) throw new Error('useWorkoutSession must be used within WorkoutSessionProvider');
  return ctx;
}
