import type { Exercise } from '@/types';

export type ExerciseLoggingMode = 'weighted' | 'bodyweight' | 'timed';

const TIMED_NAME_PATTERN =
  /\b(plank|wall\s*sit|dead\s*hang|hollow\s*hold|l[\s-]?sit|side\s*plank|superman\s*hold|iso\s*hold|static\s*hold|stretch|carry)\b/i;

const BODYWEIGHT_NAME_PATTERN =
  /\b(pull[\s-]?up|chin[\s-]?up|push[\s-]?up|dip|burpee|air\s*squat|bodyweight|inverted\s*row|muscle[\s-]?up|pistol\s*squat)\b/i;

const TIMED_REP_RANGE_PATTERN = /\d+\s*(s|sec|secs|second|seconds|min|mins|minute|minutes)\b/i;

function normalize(value: string | undefined | null): string {
  return (value ?? '').trim().toLowerCase();
}

export function isTimedExercise(
  exercise: Exercise | null | undefined,
  repRange?: string | null,
  name?: string | null,
): boolean {
  const label = normalize(name ?? exercise?.name);
  const range = normalize(repRange ?? exercise?.instructions);
  if (TIMED_REP_RANGE_PATTERN.test(range)) return true;
  if (TIMED_NAME_PATTERN.test(label)) return true;
  return false;
}

export function isBodyweightExercise(
  exercise: Exercise | null | undefined,
  name?: string | null,
): boolean {
  const label = normalize(name ?? exercise?.name);
  const equipment = normalize(exercise?.equipment);
  if (equipment.includes('bodyweight') || equipment === 'none' || equipment === 'pull_up_bar') {
    return true;
  }
  return BODYWEIGHT_NAME_PATTERN.test(label);
}

export function getExerciseLoggingMode(
  exercise: Exercise | null | undefined,
  repRange?: string | null,
  name?: string | null,
): ExerciseLoggingMode {
  if (isTimedExercise(exercise, repRange, name)) return 'timed';
  if (isBodyweightExercise(exercise, name)) return 'bodyweight';
  return 'weighted';
}

export function defaultTimedDurationSeconds(repRange?: string | null): number {
  const match = (repRange ?? '').match(/(\d+)\s*(s|sec|secs|second|seconds|min|mins|minute|minutes)\b/i);
  if (!match) return 30;
  const value = Number.parseInt(match[1], 10);
  if (Number.isNaN(value) || value <= 0) return 30;
  return /min/i.test(match[2]) ? value * 60 : value;
}

export function formatSetLoggedLabel(
  mode: ExerciseLoggingMode,
  set: { weight?: number | null; reps?: number | null; durationSeconds?: number | null },
  formatWeight: (kg: number) => string,
  weightLabel: string,
): string {
  if (mode === 'timed' && set.durationSeconds != null) {
    return `${set.durationSeconds}s hold`;
  }
  if (mode === 'bodyweight') {
    return `${set.reps ?? '—'} reps`;
  }
  if (set.weight != null && set.weight > 0) {
    return `${formatWeight(set.weight)} ${weightLabel} × ${set.reps ?? '—'}`;
  }
  return `${set.reps ?? '—'} reps`;
}
