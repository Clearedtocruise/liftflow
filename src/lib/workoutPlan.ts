import { enrichWithSupersetGroups } from '@/lib/supersetFlow';
import { prescribeExerciseExecution, normalizeExecutionMode } from '@/lib/workoutExecutionMode';
import type { PlannedWorkout, TemplateExercise } from '@/types/training';
import type { EditableWorkoutExercise } from '@/types/workoutExecution';
import type { WorkoutExecutionMode } from '@/types/workoutExecutionMode';

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
    sets: prescription.scheme === 'set_rep' ? prescription.sets : exercise.sets ?? 3,
    repRange:
      prescription.scheme === 'set_rep' || prescription.scheme === 'circuit' || prescription.scheme === 'superset'
        ? prescription.repRange
        : exercise.repRange ?? exercise.reps,
    restSeconds:
      prescription.scheme === 'set_rep'
        ? prescription.restSeconds
        : exercise.restSeconds,
    weightLbs: exercise.weightLbs,
    executionMode,
    supersetGroupId: exercise.supersetGroupId,
  };
}

export function exercisesFromPlannedWorkout(workout: PlannedWorkout | null): EditableWorkoutExercise[] {
  const raw = workout?.metadata?.exercises ?? [];
  const defaultMode = normalizeExecutionMode(workout?.metadata?.executionMode);
  return enrichWithSupersetGroups(raw.map((exercise, index) => templateToEditable(exercise, index, defaultMode)));
}

export function estimateWorkoutDurationMinutes(exercises: EditableWorkoutExercise[]): number {
  if (exercises.length === 0) return 60;
  const minutes = exercises.reduce((total, exercise) => {
    const restMinutes = ((exercise.restSeconds ?? 90) / 60) * Math.max(exercise.sets - 1, 0);
    return total + Math.max(exercise.sets * 2, 6) + restMinutes;
  }, 0);
  return Math.max(45, Math.min(75, Math.round(minutes)));
}

export function parseTargetReps(repRange?: string): number {
  if (!repRange) return 8;
  const match = repRange.match(/\d+/);
  return match ? parseInt(match[0], 10) : 8;
}
