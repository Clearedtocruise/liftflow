import { classifyExercise } from '@/lib/exerciseClassification';
import { formatDistance } from '@/lib/unitConversion';
import type { Exercise } from '@/types';
import type { DistanceUnit } from '@/types/common';
import type { ExerciseType } from '@/types/exerciseClassification';

export type ExerciseLoggingMode = 'weighted' | 'bodyweight' | 'timed' | 'cardio' | 'any';

const TIMED_NAME_PATTERN =
  /\b(plank|wall\s*sit|dead\s*hang|hollow\s*hold|l[\s-]?sit|side\s*plank|superman\s*hold|iso\s*hold|static\s*hold|stretch|carry)\b/i;

const BODYWEIGHT_NAME_PATTERN =
  /\b(pull[\s-]?up|chin[\s-]?up|push[\s-]?up|dip|burpee|air\s*squat|bodyweight|inverted\s*row|muscle[\s-]?up|pistol\s*squat)\b/i;

const TIMED_REP_RANGE_PATTERN = /\d+\s*(s|sec|secs|second|seconds|min|mins|minute|minutes)\b/i;

function normalize(value: string | undefined | null): string {
  return (value ?? '').trim().toLowerCase();
}

export function exerciseTypeToLoggingMode(type: ExerciseType): ExerciseLoggingMode {
  switch (type) {
    case 'bodyweight':
      return 'bodyweight';
    case 'timed':
      return 'timed';
    case 'cardio':
      return 'cardio';
    default:
      return 'weighted';
  }
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
  const label = name ?? exercise?.name;
  const range = repRange ?? exercise?.instructions;

  if (isTimedExercise(exercise, range, label)) {
    return 'timed';
  }

  if (exercise?.exerciseType) {
    const fromType = exerciseTypeToLoggingMode(exercise.exerciseType);
    if (fromType !== 'weighted') return fromType;
  }

  const classified = classifyExercise({
    slug: exercise?.slug,
    name: label ?? 'Exercise',
    equipment: exercise?.equipment,
    movementCategory: exercise?.category,
    exerciseType: exercise?.exerciseType,
  });
  return exerciseTypeToLoggingMode(classified);
}

export function getExerciseLoggingModeByName(name: string): ExerciseLoggingMode {
  return exerciseTypeToLoggingMode(classifyExercise({ name }));
}

export function defaultTimedDurationSeconds(repRange?: string | null): number {
  const match = (repRange ?? '').match(/(\d+)\s*(s|sec|secs|second|seconds|min|mins|minute|minutes)\b/i);
  if (!match) return 30;
  const value = Number.parseInt(match[1], 10);
  if (Number.isNaN(value) || value <= 0) return 30;
  return /min/i.test(match[2]) ? value * 60 : value;
}

export function formatCardioDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatSetLoggedLabel(
  mode: ExerciseLoggingMode,
  set: {
    weight?: number | null;
    reps?: number | null;
    durationSeconds?: number | null;
    distanceMeters?: number | null;
  },
  formatWeight: (kg: number) => string,
  weightLabel: string,
  distanceUnit: DistanceUnit = 'mi',
): string {
  if (mode === 'cardio') {
    const time = set.durationSeconds != null ? formatCardioDuration(set.durationSeconds) : '—';
    const distance =
      set.distanceMeters != null
        ? formatDistance(set.distanceMeters / 1000, distanceUnit)
        : '—';
    return `${time} · ${distance}`;
  }
  if (mode === 'timed' && set.durationSeconds != null) {
    return `${set.durationSeconds}s hold`;
  }
  if (mode === 'bodyweight') {
    return `${set.reps ?? '—'} reps`;
  }
  // Weighted lifts must not look like bodyweight when the load was missing/zero.
  if (set.weight != null && set.weight > 0) {
    return `${formatWeight(set.weight)} ${weightLabel} × ${set.reps ?? '—'}`;
  }
  return `— ${weightLabel} × ${set.reps ?? '—'}`;
}
