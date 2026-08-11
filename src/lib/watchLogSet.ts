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
  /** Reps dictated from the watch, if any. */
  draftReps?: number | null;
  /** Weight dictated from the watch, if any. */
  draftWeightKg?: number | null;
  /** Plan target, when a caller knows it. Logging past it is refused. */
  targetSets?: number | null;
};

const DEFAULT_REPS = 8;

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
  const exercise = sorted[input.activeExerciseIndex] ?? sorted[0];
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
