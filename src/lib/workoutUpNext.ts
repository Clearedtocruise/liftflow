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

export function resolveWorkoutUpNext(input: ResolveWorkoutUpNextInput): WorkoutPositionLabels {
  const activeSet =
    input.activeSetNumber != null
      ? Math.min(Math.max(1, input.activeSetNumber), input.targetSets)
      : Math.min(input.completedSetsCount + 1, input.targetSets);

  const currentSetLabel = `Set ${activeSet} of ${input.targetSets}`;

  let upNextLabel: string;
  if (activeSet < input.targetSets) {
    upNextLabel = `Set ${activeSet + 1} of ${input.targetSets}`;
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
    upNextLabel: `${nextExerciseName} · Set 1 of ${nextTargetSets}`,
  };
}
