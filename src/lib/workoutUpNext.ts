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
  const finished =
    input.activeSetNumber == null && input.completedSetsCount >= input.targetSets && input.targetSets > 0;

  const activeSet =
    input.activeSetNumber != null
      ? Math.min(Math.max(1, input.activeSetNumber), input.targetSets)
      : Math.min(input.completedSetsCount + 1, input.targetSets);

  const remainingIncludingCurrent = Math.max(0, input.targetSets - activeSet + 1);
  const currentSetLabel = finished
    ? `Set ${input.targetSets} of ${input.targetSets} · done`
    : input.activeSetNumber != null
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

/**
 * What the rest clock calls "Now".
 *
 * After the last set of a lift, rest is the rest before the next exercise. "Now" is that
 * exercise's first set — not the lift that just finished, and not "1 left" on a set already
 * logged. Mid-exercise, "Now" is the next set of the same lift.
 */
export function restPopupNow(input: ResolveWorkoutUpNextInput): WorkoutPositionLabels {
  const target = Math.max(1, input.targetSets);
  const finished = input.completedSetsCount >= target;

  if (finished && !input.isLastExercise && input.nextExerciseName) {
    const nextSets = Math.max(1, input.nextExerciseTargetSets ?? target);
    return {
      exerciseName: input.nextExerciseName,
      currentSetLabel: `Set 1 of ${nextSets}`,
      upNextLabel: nextSets > 1 ? `Set 2 of ${nextSets}` : 'Finish workout',
    };
  }

  if (!finished) {
    const nowSet = Math.min(input.completedSetsCount + 1, target);
    return {
      exerciseName: input.exerciseName,
      currentSetLabel: `Set ${nowSet} of ${target}`,
      upNextLabel:
        nowSet < target
          ? `Set ${nowSet + 1} of ${target}`
          : !input.isLastExercise && input.nextExerciseName
            ? `${input.nextExerciseName} · Set 1 of ${Math.max(1, input.nextExerciseTargetSets ?? target)}`
            : 'Finish workout',
    };
  }

  return {
    exerciseName: input.exerciseName,
    currentSetLabel: `Set ${target} of ${target} · done`,
    upNextLabel: 'Finish workout',
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
