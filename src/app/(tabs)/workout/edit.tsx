import { router } from 'expo-router';

import { WorkoutEditScreen } from '@/components/workout/execution/WorkoutEditScreen';
import { useAuth } from '@/hooks/useAuth';
import { useWorkoutPlanDraft } from '@/state/workout/WorkoutPlanDraftContext';

export default function WorkoutEditRoute() {
  const { user } = useAuth();
  const { plannedWorkout, exercises, setExercises } = useWorkoutPlanDraft();

  return (
    <WorkoutEditScreen
      workoutName={plannedWorkout?.name ?? 'Workout'}
      exercises={exercises}
      userId={user?.id}
      goal={user?.fitnessGoals?.[0]}
      programType={user?.metadata?.coachActivation?.programType}
      availableEquipment={user?.availableEquipment}
      onChange={setExercises}
      onDone={() => router.back()}
    />
  );
}
