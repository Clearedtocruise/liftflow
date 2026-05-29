import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { workoutService } from '@/services/workoutService';
import type { RestPeriod, WorkoutSession } from '@/types';

/**
 * Active workout session state — MVP implementation.
 * Manages in-memory session during a workout. Persists via workoutService in production.
 */

type WorkoutSessionState = {
  activeSession: WorkoutSession | null;
  activeRestPeriod: RestPeriod | null;
  isListening: boolean;
  isLoading: boolean;
};

type WorkoutSessionActions = {
  startSession: (name: string) => Promise<void>;
  endSession: () => Promise<void>;
  setListening: (listening: boolean) => void;
  startRestTimer: (setId: string, seconds: number) => Promise<void>;
  endRestTimer: () => Promise<void>;
};

type WorkoutSessionContextValue = WorkoutSessionState & WorkoutSessionActions;

const WorkoutSessionContext = createContext<WorkoutSessionContextValue | null>(null);

export function WorkoutSessionProvider({ children, userId }: { children: ReactNode; userId?: string }) {
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [activeRestPeriod, setActiveRestPeriod] = useState<RestPeriod | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const startSession = useCallback(async (name: string) => {
    if (!userId) return;
    setIsLoading(true);
    const result = await workoutService.startSession(userId, { name });
    if (result.success) setActiveSession(result.data);
    setIsLoading(false);
  }, [userId]);

  const endSession = useCallback(async () => {
    if (!activeSession) return;
    setIsLoading(true);
    const result = await workoutService.endSession(activeSession.id);
    if (result.success) {
      setActiveSession(null);
      setActiveRestPeriod(null);
    }
    setIsLoading(false);
  }, [activeSession]);

  const startRestTimer = useCallback(async (setId: string, seconds: number) => {
    if (!activeSession) return;
    const result = await workoutService.startRestTimer(activeSession.id, setId, seconds);
    if (result.success) setActiveRestPeriod(result.data);
  }, [activeSession]);

  const endRestTimer = useCallback(async () => {
    if (!activeRestPeriod) return;
    const elapsed = Math.floor((Date.now() - new Date(activeRestPeriod.startedAt).getTime()) / 1000);
    await workoutService.endRestTimer(activeRestPeriod.id, elapsed);
    setActiveRestPeriod(null);
  }, [activeRestPeriod]);

  const value = useMemo<WorkoutSessionContextValue>(
    () => ({
      activeSession,
      activeRestPeriod,
      isListening,
      isLoading,
      startSession,
      endSession,
      setListening: setIsListening,
      startRestTimer,
      endRestTimer,
    }),
    [activeSession, activeRestPeriod, isListening, isLoading, startSession, endSession, startRestTimer, endRestTimer],
  );

  return (
    <WorkoutSessionContext.Provider value={value}>
      {children}
    </WorkoutSessionContext.Provider>
  );
}

export function useWorkoutSession(): WorkoutSessionContextValue {
  const ctx = useContext(WorkoutSessionContext);
  if (!ctx) throw new Error('useWorkoutSession must be used within WorkoutSessionProvider');
  return ctx;
}
