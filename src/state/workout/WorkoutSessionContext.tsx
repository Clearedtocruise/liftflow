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
import { Vibration } from 'react-native';

import { DEFAULT_REST_SECONDS } from '@/constants/workout';
import { workoutService } from '@/services/workoutService';
import type { CreateSetPayload, RestPeriod, StartSessionPayload, UpdateSetPayload, WorkoutSession, WorkoutSet } from '@/types';

type WorkoutSessionState = {
  activeSession: WorkoutSession | null;
  activeRestPeriod: RestPeriod | null;
  restSecondsRemaining: number | null;
  isListening: boolean;
  isLoading: boolean;
  lastLoggedSet: WorkoutSet | null;
};

type WorkoutSessionActions = {
  hydrate: () => Promise<void>;
  refreshSession: () => Promise<void>;
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
  skipRestTimer: () => Promise<void>;
  endRestTimer: () => Promise<void>;
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
  const [activeRestPeriod, setActiveRestPeriod] = useState<RestPeriod | null>(null);
  const [restSecondsRemaining, setRestSecondsRemaining] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastLoggedSet, setLastLoggedSet] = useState<WorkoutSet | null>(null);
  const restEndAtRef = useRef<number | null>(null);
  const hapticFiredRef = useRef(false);

  const refreshSession = useCallback(async () => {
    if (!activeSession?.id) return;
    const result = await workoutService.getSession(activeSession.id);
    if (result.success) setActiveSession(result.data);
  }, [activeSession?.id]);

  const hydrate = useCallback(async () => {
    if (!userId) {
      setActiveSession(null);
      return;
    }
    setIsLoading(true);
    const result = await workoutService.getActiveSession(userId);
    if (result.success) setActiveSession(result.data);
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

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
        setActiveSession(result.data);
        return result.data;
      }
      return null;
    },
    [userId],
  );

  const endSession = useCallback(async () => {
    if (!activeSession) return null;
    setIsLoading(true);
    const result = await workoutService.endSession(activeSession.id);
    setIsLoading(false);
    if (result.success) {
      setActiveSession(null);
      setActiveRestPeriod(null);
      setRestSecondsRemaining(null);
      restEndAtRef.current = null;
      return result.data;
    }
    return null;
  }, [activeSession]);

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
    const result = await workoutService.cancelSession(activeSession.id);
    if (result.success) {
      setActiveSession(null);
      setActiveRestPeriod(null);
      setRestSecondsRemaining(null);
      restEndAtRef.current = null;
    }
  }, [activeSession]);

  const logSet = useCallback(
    async (payload: CreateSetPayload) => {
      const result = await workoutService.logSet(payload);
      if (!result.success) return null;

      setLastLoggedSet(result.data);
      await refreshSession();

      if (activeSession?.status === 'active') {
        const restResult = await workoutService.startRestTimer(
          activeSession.id,
          result.data.id,
          DEFAULT_REST_SECONDS,
        );
        if (restResult.success) {
          hapticFiredRef.current = false;
          setActiveRestPeriod(restResult.data);
          const seconds = restResult.data.recommendedSeconds ?? DEFAULT_REST_SECONDS;
          restEndAtRef.current = Date.now() + seconds * 1000;
          setRestSecondsRemaining(seconds);
        }
      }

      return result.data;
    },
    [activeSession, refreshSession],
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
      }
    },
    [activeSession],
  );

  const adjustRestTimer = useCallback((deltaSeconds: number) => {
    if (restEndAtRef.current === null) return;
    restEndAtRef.current += deltaSeconds * 1000;
    const remaining = Math.max(0, Math.ceil((restEndAtRef.current - Date.now()) / 1000));
    setRestSecondsRemaining(remaining);
  }, []);

  const skipRestTimer = useCallback(async () => {
    if (!activeRestPeriod) return;
    const elapsed = Math.floor((Date.now() - new Date(activeRestPeriod.startedAt).getTime()) / 1000);
    await workoutService.endRestTimer(activeRestPeriod.id, elapsed, true);
    setActiveRestPeriod(null);
    setRestSecondsRemaining(null);
    restEndAtRef.current = null;
  }, [activeRestPeriod]);

  const endRestTimer = useCallback(async () => {
    if (!activeRestPeriod) return;
    const elapsed = Math.floor((Date.now() - new Date(activeRestPeriod.startedAt).getTime()) / 1000);
    await workoutService.endRestTimer(activeRestPeriod.id, elapsed, false);
    setActiveRestPeriod(null);
    setRestSecondsRemaining(null);
    restEndAtRef.current = null;
  }, [activeRestPeriod]);

  const value = useMemo<WorkoutSessionContextValue>(
    () => ({
      activeSession,
      activeRestPeriod,
      restSecondsRemaining,
      isListening,
      isLoading,
      lastLoggedSet,
      hydrate,
      refreshSession,
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
      skipRestTimer,
      endRestTimer,
    }),
    [
      activeSession,
      activeRestPeriod,
      restSecondsRemaining,
      isListening,
      isLoading,
      lastLoggedSet,
      hydrate,
      refreshSession,
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
