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
  };
}

export function exercisesFromPlannedWorkout(workout: PlannedWorkout | null): EditableWorkoutExercise[] {
  const raw = workout?.metadata?.exercises ?? [];
  return raw.map(templateToEditable);
}

export function estimateWorkoutDurationMinutes(exercises: EditableWorkoutExercise[]): number {
  if (exercises.length === 0) return 45;
  const minutes = exercises.reduce((total, exercise) => total + Math.max(6, exercise.sets * 3), 0);
  return Math.max(30, minutes);
}

export function parseTargetReps(repRange?: string): number {
  if (!repRange) return 8;
  const match = repRange.match(/\d+/);
  return match ? parseInt(match[0], 10) : 8;
}
