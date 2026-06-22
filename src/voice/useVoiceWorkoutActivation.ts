import { useEffect } from 'react';

import { useVoiceWorkout } from './useVoiceWorkout';
import type { VoiceWorkoutHandlers } from './workoutCommandTypes';

type ActivationParams = {
  active: boolean;
  userId?: string;
  sessionId?: string;
  activeExerciseName?: string;
  activeExerciseId?: string;
  setNumber?: number;
  lastWeight?: number;
  lastReps?: number;
  preferredWeightUnit?: 'lb' | 'kg';
  authToken?: string;
  handlers: VoiceWorkoutHandlers | null;
};

/** Activates wake-word scope and registers workout command handlers while screen is focused. */
export function useVoiceWorkoutActivation({
  active,
  userId,
  sessionId,
  activeExerciseName,
  activeExerciseId,
  setNumber,
  lastWeight,
  lastReps,
  preferredWeightUnit,
  authToken,
  handlers,
}: ActivationParams) {
  const { setWorkoutScreenActive, setWorkoutContext, registerHandlers } = useVoiceWorkout();

  useEffect(() => {
    setWorkoutScreenActive(active);
    return () => setWorkoutScreenActive(false);
  }, [active, setWorkoutScreenActive]);

  useEffect(() => {
    setWorkoutContext({
      userId,
      sessionId,
      activeExerciseName,
      activeExerciseId,
      setNumber,
      lastWeight,
      lastReps,
      preferredWeightUnit,
      authToken,
    });
  }, [
    userId,
    sessionId,
    activeExerciseName,
    activeExerciseId,
    setNumber,
    lastWeight,
    lastReps,
    preferredWeightUnit,
    authToken,
    setWorkoutContext,
  ]);

  useEffect(() => {
    registerHandlers(active ? handlers : null);
    return () => registerHandlers(null);
  }, [active, handlers, registerHandlers]);
}
