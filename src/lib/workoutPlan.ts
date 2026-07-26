import { INTERVAL_MODE_DEFAULTS } from '@/constants/workoutExecutionModes';
import { enrichWithSupersetGroups } from '@/lib/supersetFlow';
import { normalizeExecutionMode, prescribeExerciseExecution } from '@/lib/workoutExecutionMode';
import type { PlannedWorkout, TemplateExercise } from '@/types/training';
import type { WorkoutExercise } from '@/types/workout';
import type { EditableWorkoutExercise } from '@/types/workoutExecution';
import type { WorkoutExecutionMode } from '@/types/workoutExecutionMode';

type Prescription = ReturnType<typeof prescribeExerciseExecution>;

/**
 * Strength-training set count. Interval and circuit prescriptions carry `rounds`, which is a
 * different concept, so they keep the exercise's programmed set count untouched.
 */
function setsFromPrescription(prescription: Prescription, fallback: number): number {
  if (prescription.scheme === 'set_rep' || prescription.scheme === 'superset') return prescription.sets;
  return fallback;
}

function roundsFromPrescription(prescription: Prescription): number | undefined {
  if (prescription.scheme === 'interval' || prescription.scheme === 'circuit') return prescription.rounds;
  return undefined;
}

function restFromPrescription(
  prescription: Prescription,
  fallback?: number,
): number | undefined {
  if (prescription.scheme === 'set_rep') return prescription.restSeconds;
  if (prescription.scheme === 'superset') return prescription.restBetweenRoundSetsSeconds;
  if (prescription.scheme === 'circuit') return prescription.restBetweenRoundsSeconds;
  // Interval rest is the in-round rest and lives in `intervalRestSeconds`.
  return fallback;
}

function restBetweenExercisesFromPrescription(prescription: Prescription): number | undefined {
  if (prescription.scheme === 'circuit' || prescription.scheme === 'superset') {
    return prescription.restBetweenExercisesSeconds;
  }
  return undefined;
}

function intervalTimingFromPrescription(
  prescription: Prescription,
): { intervalWorkSeconds?: number; intervalRestSeconds?: number } {
  if (prescription.scheme !== 'interval') return {};
  return {
    intervalWorkSeconds: prescription.workSeconds,
    intervalRestSeconds: prescription.restSeconds,
  };
}

function templateToEditable(
  exercise: TemplateExercise,
  index: number,
  defaultMode?: WorkoutExecutionMode,
): EditableWorkoutExercise {
  const name = exercise.exerciseName ?? exercise.name ?? 'Exercise';
  const executionMode = normalizeExecutionMode(exercise.executionMode ?? defaultMode ?? 'traditional');
  const prescription = prescribeExerciseExecution({
    name,
    mode: executionMode,
    sets: exercise.sets,
    repRange: exercise.repRange ?? exercise.reps,
    restSeconds: exercise.restSeconds,
  });

  return {
    id: `plan-${index}-${name.toLowerCase().replace(/\s+/g, '-')}`,
    exerciseId: exercise.exerciseId,
    name,
    sets: setsFromPrescription(prescription, exercise.sets ?? 3),
    intervalRounds: roundsFromPrescription(prescription),
    ...intervalTimingFromPrescription(prescription),
    restBetweenExercisesSeconds: restBetweenExercisesFromPrescription(prescription),
    repRange:
      prescription.scheme === 'set_rep' || prescription.scheme === 'circuit' || prescription.scheme === 'superset'
        ? prescription.repRange
        : exercise.repRange ?? exercise.reps,
    restSeconds: restFromPrescription(prescription, exercise.restSeconds),
    weightLbs: exercise.weightLbs,
    executionMode,
    supersetGroupId: exercise.supersetGroupId,
  };
}

export function exercisesFromPlannedWorkout(workout: PlannedWorkout | null): EditableWorkoutExercise[] {
  const raw = workout?.metadata?.exercises ?? [];
  const defaultMode = normalizeExecutionMode(workout?.metadata?.executionMode);
  return enrichWithSupersetGroups(
    raw.map((exercise, index) => templateToEditable(exercise, index, defaultMode)),
    defaultMode,
  );
}

/** Session-only timing remap — preserves exercise identity (name, id, weight). */
export function remapExercisesForExecutionMode(
  exercises: EditableWorkoutExercise[],
  mode: WorkoutExecutionMode,
): EditableWorkoutExercise[] {
  return exercises.map((exercise, index) => {
    const prescription = prescribeExerciseExecution({
      name: exercise.name,
      mode,
      sets: exercise.sets,
      repRange: exercise.repRange,
      restSeconds: exercise.restSeconds,
    });
    return {
      ...exercise,
      id: exercise.id || `plan-${index}-${exercise.name.toLowerCase().replace(/\s+/g, '-')}`,
      executionMode: mode,
      sets: setsFromPrescription(prescription, exercise.sets),
      intervalRounds: roundsFromPrescription(prescription) ?? exercise.intervalRounds,
      ...intervalTimingFromPrescription(prescription),
      restBetweenExercisesSeconds:
        restBetweenExercisesFromPrescription(prescription) ?? exercise.restBetweenExercisesSeconds,
      repRange:
        prescription.scheme === 'set_rep' || prescription.scheme === 'circuit' || prescription.scheme === 'superset'
          ? prescription.repRange
          : exercise.repRange,
      restSeconds: restFromPrescription(prescription, exercise.restSeconds),
    };
  });
}

export function exercisesForSessionStart(
  workout: PlannedWorkout | null,
  tabataModeEnabled: boolean,
): EditableWorkoutExercise[] {
  const base = exercisesFromPlannedWorkout(workout);
  if (!tabataModeEnabled) return base;
  return remapExercisesForExecutionMode(base, 'tabata');
}

const WORKING_SECONDS_PER_SET = 45;

export function estimateWorkoutDurationMinutes(exercises: EditableWorkoutExercise[]): number {
  if (exercises.length === 0) return 60;
  const seconds = exercises.reduce((total, exercise) => {
    const rounds = exercise.intervalRounds;
    if (rounds && rounds > 0 && (exercise.intervalWorkSeconds || exercise.intervalRestSeconds)) {
      const work = exercise.intervalWorkSeconds ?? INTERVAL_MODE_DEFAULTS.tabata.workSeconds;
      const rest = exercise.intervalRestSeconds ?? INTERVAL_MODE_DEFAULTS.tabata.restSeconds;
      return total + rounds * (work + rest) + (exercise.restBetweenExercisesSeconds ?? 0);
    }
    const sets = Math.max(exercise.sets, 1);
    return total + sets * WORKING_SECONDS_PER_SET + (exercise.restSeconds ?? 90) * Math.max(sets - 1, 0);
  }, 0);
  return Math.max(10, Math.round(seconds / 60));
}

/** Set target for an exercise the plan does not describe (swapped in or added mid-session). */
const UNPLANNED_TARGET_SETS = 3;

/**
 * The plan array and the live session's exercise array drift apart whenever an exercise is
 * skipped, reordered or added mid-session, so positional lookups land on the wrong slot.
 * Returns exactly one plan entry per session exercise, in session order.
 */
export function alignPlanExercisesToSession(
  planExercises: EditableWorkoutExercise[],
  sessionExercises: WorkoutExercise[],
): EditableWorkoutExercise[] {
  const slots = planExercises.map((exercise) => ({ exercise, used: false }));
  const takeMatch = (predicate: (plan: EditableWorkoutExercise) => boolean) => {
    const slot = slots.find((candidate) => !candidate.used && predicate(candidate.exercise));
    if (!slot) return undefined;
    slot.used = true;
    return slot.exercise;
  };

  const ordered = [...sessionExercises].sort((a, b) => a.sortOrder - b.sortOrder);
  const matched = ordered.map((sessionExercise) => {
    const name = sessionExercise.exercise?.name ?? '';
    return (
      (sessionExercise.exerciseId
        ? takeMatch((plan) => plan.exerciseId === sessionExercise.exerciseId)
        : undefined) ?? (name ? takeMatch((plan) => plan.name.toLowerCase() === name.toLowerCase()) : undefined)
    );
  });

  /**
   * A swapped-out exercise leaves its plan slot unclaimed, so the swapped-in exercise inherits that
   * slot's targets. Deriving the target from the logged set count instead made the target climb with
   * every set, so the exercise could never register as complete.
   */
  const unclaimed = slots.filter((slot) => !slot.used).map((slot) => slot.exercise);
  let unclaimedIndex = 0;

  return ordered.map((sessionExercise, index) => {
    const plan = matched[index];
    if (plan) return plan;

    const inherited = unclaimed[unclaimedIndex];
    unclaimedIndex += 1;
    const name = sessionExercise.exercise?.name ?? '';
    return {
      id: `session-${sessionExercise.id}`,
      exerciseId: sessionExercise.exerciseId,
      name: name || 'Exercise',
      sets: inherited?.sets ?? UNPLANNED_TARGET_SETS,
      repRange: inherited?.repRange ?? sessionExercise.suggestedReps,
      restSeconds: inherited?.restSeconds,
    };
  });
}

export function parseTargetReps(repRange?: string): number {
  if (!repRange) return 8;
  const match = repRange.match(/\d+/);
  return match ? parseInt(match[0], 10) : 8;
}

export function editableExercisesToTemplate(
  exercises: EditableWorkoutExercise[],
): import('@/types/training').TemplateExercise[] {
  return exercises.map((exercise) => ({
    exerciseId: exercise.exerciseId,
    exerciseName: exercise.name,
    name: exercise.name,
    sets: exercise.sets,
    repRange: exercise.repRange,
    restSeconds: exercise.restSeconds,
    weightLbs: exercise.weightLbs,
    executionMode: exercise.executionMode,
    supersetGroupId: exercise.supersetGroupId,
  }));
}
