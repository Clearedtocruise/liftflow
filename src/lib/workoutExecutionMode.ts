import {
    CIRCUIT_MODE_DEFAULTS,
    INTERVAL_MODE_DEFAULTS,
    SET_REP_MODE_DEFAULTS,
    SUPERSET_MODE_DEFAULTS,
} from '@/constants/workoutExecutionModes';
import type {
    ExerciseExecutionPrescription,
    ExercisePrescriptionInput,
    PrescribedWorkoutExercise,
    WorkoutExecutionMode,
} from '@/types/workoutExecutionMode';

function isSetRepMode(mode: WorkoutExecutionMode): mode is keyof typeof SET_REP_MODE_DEFAULTS {
  return mode === 'traditional' || mode === 'hypertrophy' || mode === 'strength';
}

function isIntervalMode(mode: WorkoutExecutionMode): mode is keyof typeof INTERVAL_MODE_DEFAULTS {
  return mode === 'hiit' || mode === 'tabata';
}

/**
 * Resolve how a single exercise should be executed under a workout mode.
 */
export function prescribeExerciseExecution(input: ExercisePrescriptionInput): ExerciseExecutionPrescription {
  const { mode, sets, repRange, restSeconds } = input;

  if (isSetRepMode(mode)) {
    const defaults = SET_REP_MODE_DEFAULTS[mode];
    return {
      scheme: 'set_rep',
      mode,
      sets: sets ?? defaults.sets,
      repRange: repRange ?? defaults.repRange,
      restSeconds: restSeconds ?? defaults.restSeconds,
    };
  }

  if (isIntervalMode(mode)) {
    const defaults = INTERVAL_MODE_DEFAULTS[mode];
    return {
      scheme: 'interval',
      mode,
      workSeconds: defaults.workSeconds,
      restSeconds: defaults.restSeconds,
      rounds: defaults.rounds,
    };
  }

  if (mode === 'circuit') {
    return {
      scheme: 'circuit',
      mode: 'circuit',
      rounds: CIRCUIT_MODE_DEFAULTS.rounds,
      repRange: repRange ?? CIRCUIT_MODE_DEFAULTS.repRange,
      restBetweenExercisesSeconds: CIRCUIT_MODE_DEFAULTS.restBetweenExercisesSeconds,
      restBetweenRoundsSeconds: CIRCUIT_MODE_DEFAULTS.restBetweenRoundsSeconds,
    };
  }

  return {
    scheme: 'superset',
    mode: 'superset',
    sets: sets ?? SUPERSET_MODE_DEFAULTS.sets,
    repRange: repRange ?? SUPERSET_MODE_DEFAULTS.repRange,
    restBetweenExercisesSeconds: SUPERSET_MODE_DEFAULTS.restBetweenExercisesSeconds,
    restBetweenRoundSetsSeconds: SUPERSET_MODE_DEFAULTS.restBetweenRoundSetsSeconds,
  };
}

/** Apply a workout execution mode to every exercise in a plan. */
export function prescribeWorkoutExecution(
  exercises: ExercisePrescriptionInput[],
  mode: WorkoutExecutionMode,
): PrescribedWorkoutExercise[] {
  return exercises.map((exercise) => ({
    name: exercise.name,
    mode,
    prescription: prescribeExerciseExecution({ ...exercise, mode }),
  }));
}

/** Human-readable summary for logging, coach copy, and validation. */
export function formatExercisePrescriptionSummary(prescription: ExerciseExecutionPrescription): string {
  switch (prescription.scheme) {
    case 'set_rep':
      return `${prescription.sets} x ${prescription.repRange}`;
    case 'interval':
      return `${prescription.workSeconds} sec work · ${prescription.restSeconds} sec rest · ${prescription.rounds} rounds`;
    case 'circuit':
      return `${prescription.rounds} rounds · ${prescription.repRange} reps · ${prescription.restBetweenExercisesSeconds}s between stations`;
    case 'superset':
      return `${prescription.sets} x ${prescription.repRange} · ${prescription.restBetweenRoundSetsSeconds}s between superset rounds`;
    default:
      return '';
  }
}

export function executionModeUsesIntervals(mode: WorkoutExecutionMode): boolean {
  return isIntervalMode(mode);
}

export function executionModeUsesSetReps(mode: WorkoutExecutionMode): boolean {
  return isSetRepMode(mode);
}
