import { useMemo } from 'react';

import { WorkoutTimerOverlay } from '@/components/workout/execution/WorkoutTimerOverlay';
import { DEFAULT_REST_SECONDS } from '@/constants/workout';
import { resolveWorkoutUpNext } from '@/lib/workoutUpNext';
import { useWorkoutSession } from '@/state/workout/WorkoutSessionContext';

/** Traditional rest timer — mounted at app root so it survives tab navigation. */
export function GlobalRestTimerOverlay() {
  const {
    activeSession,
    activeExerciseIndex,
    activeRestPeriod,
    restSecondsRemaining,
    restTimerPaused,
    exerciseEffectiveTargetSets,
    adjustRestTimer,
    setRestTimer,
    pauseRestTimer,
    resumeRestTimer,
    skipRestTimer,
  } = useWorkoutSession();

  const position = useMemo(() => {
    if (!activeSession) return null;
    const sorted = [...activeSession.exercises].sort((a, b) => a.sortOrder - b.sortOrder);
    const current = sorted[activeExerciseIndex];
    if (!current) return null;

    const completedSetsCount = current.sets?.length ?? 0;
    const targetSets = exerciseEffectiveTargetSets[current.id] ?? Math.max(completedSetsCount + 1, 3);
    const next = sorted[activeExerciseIndex + 1];
    const isLastExercise = activeExerciseIndex >= sorted.length - 1;

    return resolveWorkoutUpNext({
      exerciseName: current.exercise?.name ?? 'Exercise',
      targetSets,
      completedSetsCount,
      isLastExercise,
      nextExerciseName: next?.exercise?.name,
      nextExerciseTargetSets: next ? (exerciseEffectiveTargetSets[next.id] ?? 3) : undefined,
    });
  }, [activeSession, activeExerciseIndex, exerciseEffectiveTargetSets]);

  const restActive =
    activeSession?.status === 'active' &&
    activeRestPeriod != null &&
    restSecondsRemaining != null &&
    restSecondsRemaining > 0;

  if (!restActive) return null;

  return (
    <WorkoutTimerOverlay
      visible
      position={position}
      traditional={{
        secondsRemaining: restSecondsRemaining,
        recommendedSeconds: activeRestPeriod.recommendedSeconds ?? DEFAULT_REST_SECONDS,
        isPaused: restTimerPaused,
        onPause: pauseRestTimer,
        onResume: resumeRestTimer,
        onSkip: () => void skipRestTimer(),
        onAdjust: adjustRestTimer,
        onSetRest: setRestTimer,
      }}
    />
  );
}
