import { router } from 'expo-router';

import { WorkoutEditScreen } from '@/components/workout/execution/WorkoutEditScreen';
import { useWorkoutPlanDraft } from '@/state/workout/WorkoutPlanDraftContext';

export default function WorkoutEditRoute() {
  const { plannedWorkout, exercises, setExercises } = useWorkoutPlanDraft();

  return (
    <WorkoutEditScreen
      workoutName={plannedWorkout?.name ?? 'Workout'}
      exercises={exercises}
      onChange={setExercises}
      onDone={() => router.back()}
    />
  );
}
