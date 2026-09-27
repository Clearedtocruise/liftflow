/**
 * Resolves what a "Log Set" tap from the Apple Watch should record when the phone is not sitting
 * on the workout screen.
 *
 * The rich handler in ActiveWorkoutScreen knows about supersets, rest flow and progression, so it
 * stays in charge whenever it is mounted. Without it the watch used to fail outright with "Open
 * your workout on iPhone", which defeats the point of logging from your wrist mid-set.
 */

import type { WorkoutSession } from '@/types';

export type WatchSetPayload = {
  workoutExerciseId: string;
  weight: number;
  reps: number;
};

export type WatchSetResolution =
  | { ok: true; payload: WatchSetPayload; exerciseName: string }
  | { ok: false; error: string };

export type WatchLogSetInput = {
  session: WorkoutSession | null;
  activeExerciseIndex: number;
  /**
   * The workout_exercise the watch face is currently showing, as last pushed from the phone.
   * It wins over the index: the set belongs to the lift named on the wrist.
   */
  displayedWorkoutExerciseId?: string | null;
  /** Reps dictated from the watch, if any. */
  draftReps?: number | null;
  /** Weight dictated from the watch, if any. */
  draftWeightKg?: number | null;
  /** Plan target, when a caller knows it. Logging past it is refused. */
  targetSets?: number | null;
};

const DEFAULT_REPS = 8;

/**
 * The exercise a wrist tap belongs to.
 *
 * The phone pushes the watch face by clamping the active index into range; the log path used to
 * read `sorted[index] ?? sorted[0]` instead. When the index ran past the end — an exercise deleted
 * mid-workout, a stale index after a session refresh — the wrist showed the last lift and the set
 * was written to the first one. Same input, two answers, and the set landed under a lift the
 * user never touched.
 *
 * Both sides call this now, and the id the watch is displaying wins over any index at all.
 */
export function resolveWatchActiveExercise<T extends { id: string; isActive?: boolean }>(
  sortedExercises: T[],
  options: { activeExerciseIndex?: number | null; displayedWorkoutExerciseId?: string | null },
): T | undefined {
  if (sortedExercises.length === 0) return undefined;

  if (options.displayedWorkoutExerciseId) {
    const displayed = sortedExercises.find((exercise) => exercise.id === options.displayedWorkoutExerciseId);
    if (displayed) return displayed;
  }

  const flagged = sortedExercises.find((exercise) => exercise.isActive);
  if (flagged) return flagged;

  const requested = options.activeExerciseIndex ?? 0;
  const clamped = Math.min(Math.max(requested, 0), sortedExercises.length - 1);
  return sortedExercises[clamped];
}

/** "8-10" → 8; "12" → 12. */
export function parseFirstNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.match(/\d+/);
  if (!match) return undefined;
  const parsed = Number.parseInt(match[0], 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function resolveWatchSetPayload(input: WatchLogSetInput): WatchSetResolution {
  const { session } = input;

  if (!session) {
    return { ok: false, error: 'Start a workout on iPhone first.' };
  }
  if (session.status === 'paused') {
    return { ok: false, error: 'Resume your workout to log sets.' };
  }
  if (session.status === 'completed' || session.status === 'cancelled') {
    return { ok: false, error: 'This workout is already finished.' };
  }

  const sorted = [...session.exercises].sort((a, b) => a.sortOrder - b.sortOrder);
  const exercise = resolveWatchActiveExercise(sorted, {
    activeExerciseIndex: input.activeExerciseIndex,
    displayedWorkoutExerciseId: input.displayedWorkoutExerciseId,
  });
  if (!exercise) {
    return { ok: false, error: 'No exercise selected.' };
  }

  const loggedSets = exercise.sets ?? [];
  if (input.targetSets != null && input.targetSets > 0 && loggedSets.length >= input.targetSets) {
    return { ok: false, error: 'All planned sets are already logged.' };
  }

  const lastSet = loggedSets[loggedSets.length - 1];

  const reps =
    positive(input.draftReps) ??
    positive(lastSet?.reps) ??
    parseFirstNumber(exercise.suggestedReps) ??
    DEFAULT_REPS;

  // Weight legitimately stays 0 for bodyweight work, so it is not required.
  const weight =
    nonNegative(input.draftWeightKg) ??
    nonNegative(lastSet?.weight) ??
    nonNegative(exercise.suggestedWeight);

  if (weight == null) {
    // Strength lifts must not silently log at 0 lb from the watch.
    const name = (exercise.exercise?.name ?? '').toLowerCase();
    const looksBodyweight =
      /\b(pull[\s-]?up|chin[\s-]?up|push[\s-]?up|dip|burpee|plank|bodyweight)\b/i.test(name);
    if (!looksBodyweight) {
      return { ok: false, error: 'Set a weight on iPhone or Watch before logging.' };
    }
  }

  return {
    ok: true,
    exerciseName: exercise.exercise?.name ?? 'Exercise',
    payload: {
      workoutExerciseId: exercise.id,
      weight: round1(weight ?? 0),
      reps,
    },
  };
}

function positive(value: number | null | undefined): number | undefined {
  return value != null && Number.isFinite(value) && value > 0 ? value : undefined;
}

function nonNegative(value: number | null | undefined): number | undefined {
  return value != null && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
