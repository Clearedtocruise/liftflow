export type WorkoutPositionLabels = {
  exerciseName: string;
  currentSetLabel: string;
  upNextLabel: string;
};

type ResolveWorkoutUpNextInput = {
  exerciseName: string;
  targetSets: number;
  completedSetsCount: number;
  isLastExercise: boolean;
  nextExerciseName?: string | null;
  nextExerciseTargetSets?: number;
  /** Tabata/HIIT — use the active interval round as the set number. */
  activeSetNumber?: number | null;
};

/** e.g. "Round 3 of 10 · 8 left" (remaining includes the current round). */
export function formatIntervalRoundProgress(round: number, totalRounds: number): string {
  const safeTotal = Math.max(1, totalRounds);
  const safeRound = Math.min(Math.max(1, round), safeTotal);
  const left = Math.max(0, safeTotal - safeRound + 1);
  return `Round ${safeRound} of ${safeTotal} · ${left} left`;
}

export function resolveWorkoutUpNext(input: ResolveWorkoutUpNextInput): WorkoutPositionLabels {
  const activeSet =
    input.activeSetNumber != null
      ? Math.min(Math.max(1, input.activeSetNumber), input.targetSets)
      : Math.min(input.completedSetsCount + 1, input.targetSets);

  const remainingIncludingCurrent = Math.max(0, input.targetSets - activeSet + 1);
  const currentSetLabel =
    input.activeSetNumber != null
      ? formatIntervalRoundProgress(activeSet, input.targetSets)
      : `Set ${activeSet} of ${input.targetSets} · ${remainingIncludingCurrent} left`;

  let upNextLabel: string;
  if (activeSet < input.targetSets) {
    const nextLeft = Math.max(0, input.targetSets - (activeSet + 1) + 1);
    upNextLabel =
      input.activeSetNumber != null
        ? `Round ${activeSet + 1} of ${input.targetSets} · ${nextLeft} left`
        : `Set ${activeSet + 1} of ${input.targetSets} · ${nextLeft} left`;
  } else if (!input.isLastExercise && input.nextExerciseName) {
    const nextSets = input.nextExerciseTargetSets ?? input.targetSets;
    upNextLabel = `${input.nextExerciseName} · Set 1 of ${nextSets}`;
  } else {
    upNextLabel = 'Finish workout';
  }

  return {
    exerciseName: input.exerciseName,
    currentSetLabel,
    upNextLabel,
  };
}

export function resolveBetweenExerciseUpNext(
  nextExerciseName: string,
  nextTargetSets: number,
): WorkoutPositionLabels {
  return {
    exerciseName: nextExerciseName,
    currentSetLabel: 'Rest between exercises',
    upNextLabel: `${nextExerciseName} · ${nextTargetSets} rounds`,
  };
}

export function resolveTabataPrepUpNext(
  exerciseName: string,
  targetSets: number,
): WorkoutPositionLabels {
  return {
    exerciseName,
    currentSetLabel: `Log weight · ${targetSets} round${targetSets === 1 ? '' : 's'}`,
    upNextLabel: `Then Round 1 of ${targetSets} · ${targetSets} left`,
  };
}
