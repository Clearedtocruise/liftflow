import { useMemo } from 'react';

import { WorkoutTimerOverlay } from '@/components/workout/execution/WorkoutTimerOverlay';
import { DEFAULT_REST_SECONDS } from '@/constants/workout';
import { useWorkoutSession } from '@/state/workout/WorkoutSessionContext';

/** Traditional rest timer — mounted at app root so it survives tab navigation. */
export function GlobalRestTimerOverlay() {
  const {
    activeSession,
    activeExerciseIndex,
    activeRestPeriod,
    restSecondsRemaining,
    restTimerPaused,
    adjustRestTimer,
    setRestTimer,
    pauseRestTimer,
    resumeRestTimer,
    skipRestTimer,
  } = useWorkoutSession();

  const nextExercisePreview = useMemo(() => {
    if (!activeSession) return { name: null as string | null, detail: null as string | null };
    const sorted = [...activeSession.exercises].sort((a, b) => a.sortOrder - b.sortOrder);
    const next = sorted[activeExerciseIndex + 1];
    if (!next) return { name: null, detail: null };
    return {
      name: next.exercise?.name ?? null,
      detail: next.suggestedReps ? `${next.suggestedReps} reps` : null,
    };
  }, [activeSession, activeExerciseIndex]);

  const restActive =
    activeSession?.status === 'active' &&
    activeRestPeriod != null &&
    restSecondsRemaining != null &&
    restSecondsRemaining > 0;

  if (!restActive) return null;

  return (
    <WorkoutTimerOverlay
      visible
      traditional={{
        secondsRemaining: restSecondsRemaining,
        recommendedSeconds: activeRestPeriod.recommendedSeconds ?? DEFAULT_REST_SECONDS,
        isPaused: restTimerPaused,
        onPause: pauseRestTimer,
        onResume: resumeRestTimer,
        onSkip: () => void skipRestTimer(),
        onAdjust: adjustRestTimer,
        onSetRest: setRestTimer,
        nextExerciseName: nextExercisePreview.name,
        nextExerciseDetail: nextExercisePreview.detail,
      }}
    />
  );
}
