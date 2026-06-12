import { enrichWithSupersetGroups } from '@/lib/supersetFlow';
import type { PlannedWorkout, TemplateExercise } from '@/types/training';
import type { EditableWorkoutExercise } from '@/types/workoutExecution';

function templateToEditable(exercise: TemplateExercise, index: number): EditableWorkoutExercise {
  const name = exercise.exerciseName ?? exercise.name ?? 'Exercise';
  return {
    id: `plan-${index}-${name.toLowerCase().replace(/\s+/g, '-')}`,
    name,
    sets: exercise.sets ?? 3,
    repRange: exercise.repRange ?? exercise.reps,
    restSeconds: exercise.restSeconds,
    weightLbs: exercise.weightLbs,
    supersetGroupId: exercise.supersetGroupId,
  };
}

export function exercisesFromPlannedWorkout(workout: PlannedWorkout | null): EditableWorkoutExercise[] {
  const raw = workout?.metadata?.exercises ?? [];
  return enrichWithSupersetGroups(raw.map(templateToEditable));
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
