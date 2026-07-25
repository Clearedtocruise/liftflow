import type { ExerciseLoggingMode } from '@/lib/exerciseModality';
import { defaultTimedDurationSeconds, formatCardioDuration } from '@/lib/exerciseModality';
import { formatDistance } from '@/lib/unitConversion';
import type { WorkoutSession } from '@/types';
import type { DistanceUnit } from '@/types/common';
import type { ExerciseCoachPrescription } from '@/types/exerciseCoach';
import type { EditableWorkoutExercise } from '@/types/workoutExecution';

export type WorkoutSetProgress = {
  completedSets: number;
  totalSets: number;
  percent: number;
};

export type WorkoutExerciseProgress = {
  currentExerciseNumber: number;
  totalExercises: number;
  percent: number;
};

export function resolvePlanMetaForSessionExercise(
  sessionExercise: WorkoutSession['exercises'][number] | undefined,
  index: number,
  planExercises: EditableWorkoutExercise[],
): EditableWorkoutExercise | undefined {
  if (!sessionExercise) return planExercises[index];
  return (
    planExercises[index] ??
    planExercises.find(
      (item) => item.name.toLowerCase() === sessionExercise.exercise?.name?.toLowerCase(),
    )
  );
}

export function computeWorkoutSetProgress(
  sessionExercises: WorkoutSession['exercises'],
  planExercises: EditableWorkoutExercise[],
): WorkoutSetProgress {
  const sorted = [...sessionExercises].sort((a, b) => a.sortOrder - b.sortOrder);
  let totalSets = 0;
  let completedSets = 0;

  sorted.forEach((exercise, index) => {
    const meta = resolvePlanMetaForSessionExercise(exercise, index, planExercises);
    const target = meta?.sets ?? Math.max(exercise.sets.length, 3);
    totalSets += target;
    completedSets += exercise.sets.length;
  });

  const percent = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;
  return { completedSets, totalSets, percent: Math.min(100, percent) };
}

export function computeWorkoutExerciseProgress(
  currentIndex: number,
  totalExercises: number,
): WorkoutExerciseProgress {
  const safeTotal = Math.max(totalExercises, 0);
  if (safeTotal === 0) {
    return { currentExerciseNumber: 0, totalExercises: 0, percent: 0 };
  }

  const currentExerciseNumber = Math.min(Math.max(currentIndex + 1, 0), safeTotal);
  const percent = Math.round((currentExerciseNumber / safeTotal) * 100);
  return {
    currentExerciseNumber,
    totalExercises: safeTotal,
    percent: Math.min(100, Math.max(0, percent)),
  };
}

export function formatPreviousPerformanceLine(
  set: { weightKg?: number; reps?: number; durationSeconds?: number; distanceMeters?: number },
  mode: ExerciseLoggingMode,
  formatWeight: (kg: number) => string,
  weightLabel: string,
  distanceUnit: DistanceUnit = 'mi',
): string {
  if (mode === 'cardio') {
    const time = set.durationSeconds != null ? formatCardioDuration(set.durationSeconds) : '—';
    const distance =
      set.distanceMeters != null ? formatDistance(set.distanceMeters / 1000, distanceUnit) : '—';
    return `${time} · ${distance}`;
  }
  if (mode === 'timed' && set.durationSeconds != null) {
    return `${set.durationSeconds}s hold`;
  }
  if (mode === 'bodyweight' && set.reps != null) {
    return `${set.reps} reps`;
  }
  if (set.weightKg != null && set.weightKg > 0 && set.reps != null) {
    return `${formatWeight(set.weightKg)} ${weightLabel} × ${set.reps}`;
  }
  if (set.reps != null) {
    return `${set.reps} reps`;
  }
  return '—';
}

export function formatPlanTargetPerformance(
  mode: ExerciseLoggingMode,
  targetSets: number,
  repRange: string,
  formatWeight: (kg: number) => string,
  weightLabel: string,
  weightKg?: number,
): string {
  if (mode === 'cardio') {
    return `${targetSets} set · log time and distance`;
  }
  if (mode === 'timed') {
    const match = repRange.match(/(\d+)\s*(s|sec|secs|second|seconds|min|mins|minute|minutes)\b/i);
    if (match) {
      const value = Number.parseInt(match[1], 10);
      const seconds = /min/i.test(match[2]) ? value * 60 : value;
      return `${targetSets} sets × ${seconds}s hold`;
    }
    return `${targetSets} sets × ${repRange}`;
  }
  if (mode === 'bodyweight') {
    return `${targetSets} sets × ${repRange} reps`;
  }
  if (weightKg != null && weightKg > 0) {
    return `${formatWeight(weightKg)} ${weightLabel} × ${repRange} reps`;
  }
  return `${targetSets} sets × ${repRange} reps`;
}

export function formatCoachTargetLine(
  targets: ExerciseCoachPrescription['targets'],
  mode: ExerciseLoggingMode,
  formatWeight: (kg: number) => string,
  weightLabel: string,
  plannedReps?: string,
): string {
  if (mode === 'cardio') {
    return 'Log time and distance';
  }
  if (mode === 'timed') {
    const seconds = targets.durationSeconds ?? defaultTimedDurationSeconds(targets.repRange || plannedReps);
    return `${targets.sets} sets × ${seconds}s hold`;
  }
  if (mode === 'bodyweight') {
    return `${targets.sets} sets × ${targets.reps} reps`;
  }
  if (targets.weightKg > 0) {
    return `${formatWeight(targets.weightKg)} ${weightLabel} × ${targets.reps} reps`;
  }
  return `${targets.sets} sets × ${targets.reps} reps`;
}
