/**
 * Pure editor state for authoring a custom day-based program (create + edit screens).
 *
 * Keeps the add / remove / replace / reorder / edit-set logic out of the React component so it can
 * be unit-tested. Produces a `CycleProgramInput` for the API. Editing is non-destructive: every
 * helper returns a new draft, so undo/redo and "changes affect future workouts only" stay simple.
 */

import { clampCycleLength, CYCLE_MAX_DAYS, CYCLE_MIN_DAYS } from '@/lib/programCycle';
import { isIntervalExecutionMode, normalizeExecutionMode } from '@/lib/workoutExecutionMode';
import type { CycleProgramInput } from '@/types/programCycle';
import type { TemplateExercise } from '@/types/training';
import type { WorkoutExecutionMode } from '@/types/workoutExecutionMode';

export type DraftExercise = {
  name: string;
  sets: number;
  reps: string;
  weightLbs?: number;
  notes?: string;
  exerciseId?: string;
  /**
   * Not editable in the UI, but carried so an edit does not silently reset them. A plan that
   * prescribes three minutes between heavy singles used to come back out of the editor at the 90s
   * default simply because the draft had nowhere to put the value.
   */
  restSeconds?: number;
  executionMode?: WorkoutExecutionMode;
  supersetGroupId?: string;
};

export type DraftDay = {
  label: string;
  isRest: boolean;
  exercises: DraftExercise[];
  /**
   * How the whole day is run. Drives the session: a day saved as `tabata` materializes with that
   * mode on the planned workout, which is what puts the lifter on the interval timer instead of
   * straight sets.
   */
  executionMode?: WorkoutExecutionMode;
  /** A document's own interval prescription, when it gave one, in place of the mode defaults. */
  intervalWorkSeconds?: number;
  intervalRestSeconds?: number;
  intervalRounds?: number;
};

export const CYCLE_LENGTH_MIN = CYCLE_MIN_DAYS;
export const CYCLE_LENGTH_MAX = CYCLE_MAX_DAYS;

function defaultLabel(index: number, isRest: boolean): string {
  return isRest ? 'Rest' : `Day ${index + 1}`;
}

export function createEmptyDay(index: number): DraftDay {
  return { label: defaultLabel(index, false), isRest: false, exercises: [] };
}

export function createEmptyDraft(lengthDays: number): DraftDay[] {
  const length = clampCycleLength(lengthDays);
  return Array.from({ length }, (_, i) => createEmptyDay(i));
}

/** Grow or shrink the draft to `lengthDays`, preserving existing days. New days start as workout days. */
export function setCycleLength(days: DraftDay[], lengthDays: number): DraftDay[] {
  const length = clampCycleLength(lengthDays);
  if (length === days.length) return days;
  if (length < days.length) return days.slice(0, length);
  const grown = [...days];
  for (let i = days.length; i < length; i += 1) grown.push(createEmptyDay(i));
  return grown;
}

export function toggleRestDay(days: DraftDay[], index: number): DraftDay[] {
  return days.map((day, i) => {
    if (i !== index) return day;
    const isRest = !day.isRest;
    return {
      ...day,
      isRest,
      // Rest days carry no exercises; flipping back leaves the (now empty) list to refill.
      exercises: isRest ? [] : day.exercises,
      label: day.label && day.label !== 'Rest' && day.label !== defaultLabel(i, !isRest) ? day.label : defaultLabel(i, isRest),
    };
  });
}

export function setDayLabel(days: DraftDay[], index: number, label: string): DraftDay[] {
  return days.map((day, i) => (i === index ? { ...day, label } : day));
}

export function addExercise(days: DraftDay[], dayIndex: number, exercise: DraftExercise): DraftDay[] {
  return days.map((day, i) => (i === dayIndex ? { ...day, isRest: false, exercises: [...day.exercises, exercise] } : day));
}

export function removeExercise(days: DraftDay[], dayIndex: number, exerciseIndex: number): DraftDay[] {
  return days.map((day, i) =>
    i === dayIndex ? { ...day, exercises: day.exercises.filter((_, e) => e !== exerciseIndex) } : day,
  );
}

/** Replace an exercise in place (keeps its position and set/rep targets by default). */
export function replaceExercise(
  days: DraftDay[],
  dayIndex: number,
  exerciseIndex: number,
  replacement: Partial<DraftExercise> & { name: string },
): DraftDay[] {
  return days.map((day, i) => {
    if (i !== dayIndex) return day;
    return {
      ...day,
      exercises: day.exercises.map((ex, e) => (e === exerciseIndex ? { ...ex, ...replacement } : ex)),
    };
  });
}

export function moveExercise(days: DraftDay[], dayIndex: number, from: number, to: number): DraftDay[] {
  return days.map((day, i) => {
    if (i !== dayIndex) return day;
    if (to < 0 || to >= day.exercises.length || from < 0 || from >= day.exercises.length) return day;
    const next = [...day.exercises];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    return { ...day, exercises: next };
  });
}

export function updateExerciseField(
  days: DraftDay[],
  dayIndex: number,
  exerciseIndex: number,
  patch: Partial<DraftExercise>,
): DraftDay[] {
  return days.map((day, i) => {
    if (i !== dayIndex) return day;
    return {
      ...day,
      exercises: day.exercises.map((ex, e) => (e === exerciseIndex ? { ...ex, ...patch } : ex)),
    };
  });
}

function toTemplateExercise(exercise: DraftExercise): TemplateExercise {
  return {
    name: exercise.name,
    exerciseName: exercise.name,
    sets: Math.max(1, Math.round(exercise.sets || 3)),
    repRange: exercise.reps || '8-10',
    reps: exercise.reps || '8-10',
    weightLbs: exercise.weightLbs && exercise.weightLbs > 0 ? exercise.weightLbs : undefined,
    notes: exercise.notes,
    exerciseId: exercise.exerciseId,
    restSeconds: exercise.restSeconds,
    executionMode: exercise.executionMode,
    supersetGroupId: exercise.supersetGroupId,
  };
}

export function draftToCycleInput(name: string | undefined, days: DraftDay[]): CycleProgramInput {
  return {
    name: name?.trim() || undefined,
    lengthDays: clampCycleLength(days.length),
    days: days.map((day) => ({
      label: day.label?.trim() || undefined,
      isRest: day.isRest,
      executionMode: day.isRest ? undefined : day.executionMode,
      // Interval timings only mean something on a mode that runs on a clock.
      ...(day.isRest || !isIntervalExecutionMode(day.executionMode)
        ? {}
        : {
            intervalWorkSeconds: day.intervalWorkSeconds,
            intervalRestSeconds: day.intervalRestSeconds,
            intervalRounds: day.intervalRounds,
          }),
      exercises: day.isRest ? [] : day.exercises.map(toTemplateExercise),
    })),
  };
}

/** Load an existing cycle (from the API) back into editable draft form. */
export function cycleToDraft(
  days: Array<{
    label?: string;
    isRest?: boolean;
    exercises?: TemplateExercise[];
    executionMode?: string;
    intervalWorkSeconds?: number;
    intervalRestSeconds?: number;
    intervalRounds?: number;
  }>,
): DraftDay[] {
  return days.map((day, i) => ({
    label: day.label ?? defaultLabel(i, Boolean(day.isRest)),
    isRest: Boolean(day.isRest),
    executionMode: day.executionMode ? normalizeExecutionMode(day.executionMode) : undefined,
    intervalWorkSeconds: day.intervalWorkSeconds,
    intervalRestSeconds: day.intervalRestSeconds,
    intervalRounds: day.intervalRounds,
    exercises: (day.exercises ?? []).map((ex) => ({
      name: ex.name ?? ex.exerciseName ?? 'Exercise',
      sets: ex.sets ?? 3,
      reps: ex.repRange ?? ex.reps ?? '8-10',
      weightLbs: ex.weightLbs,
      notes: ex.notes,
      exerciseId: ex.exerciseId,
      restSeconds: ex.restSeconds,
      executionMode: ex.executionMode,
      supersetGroupId: ex.supersetGroupId,
    })),
  }));
}

export function setDayExecutionMode(
  days: DraftDay[],
  index: number,
  mode: WorkoutExecutionMode | undefined,
): DraftDay[] {
  return days.map((day, i) => {
    if (i !== index) return day;
    if (!mode || mode === 'traditional') {
      return { ...day, executionMode: undefined, intervalWorkSeconds: undefined, intervalRestSeconds: undefined, intervalRounds: undefined };
    }
    if (!isIntervalExecutionMode(mode)) {
      return { ...day, executionMode: mode, intervalWorkSeconds: undefined, intervalRestSeconds: undefined, intervalRounds: undefined };
    }
    return { ...day, executionMode: mode };
  });
}

export function setDayIntervalField(
  days: DraftDay[],
  index: number,
  key: 'intervalWorkSeconds' | 'intervalRestSeconds' | 'intervalRounds',
  value: number,
): DraftDay[] {
  return days.map((day, i) => (i === index ? { ...day, [key]: value > 0 ? value : undefined } : day));
}

export function isDraftValid(days: DraftDay[]): { valid: boolean; reason?: string } {
  if (days.length < CYCLE_LENGTH_MIN || days.length > CYCLE_LENGTH_MAX) {
    return { valid: false, reason: `A program must be ${CYCLE_LENGTH_MIN}–${CYCLE_LENGTH_MAX} days.` };
  }
  const hasAnyWorkout = days.some((day) => !day.isRest && day.exercises.length > 0);
  if (!hasAnyWorkout) {
    return { valid: false, reason: 'Add at least one exercise to a workout day.' };
  }
  return { valid: true };
}
