import { router } from 'expo-router';
import { useCallback, useState } from 'react';

import { WorkoutEditScreen } from '@/components/workout/execution/WorkoutEditScreen';
import { useAuth } from '@/hooks/useAuth';
import { trainingService } from '@/services/trainingService';
import { useWorkoutPlanDraft } from '@/state/workout/WorkoutPlanDraftContext';

export default function WorkoutEditRoute() {
  const { user } = useAuth();
  const { plannedWorkout, exercises, isDirty, setExercises, markSaved, discardEdits } =
    useWorkoutPlanDraft();

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleDone = useCallback(async () => {
    // Done used to be `router.back()` and nothing else, so add, remove, reorder and rest changes
    // lived only in memory and were lost on the next plan reload.
    if (!plannedWorkout) {
      router.back();
      return;
    }
    if (!isDirty) {
      router.back();
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const result = await trainingService.updatePlannedWorkoutExercises(
        plannedWorkout.id,
        exercises,
        plannedWorkout.metadata,
      );
      if (!result.success) {
        setSaveError(result.error);
        return;
      }
      markSaved(result.data);
      router.back();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save your changes.');
    } finally {
      setSaving(false);
    }
  }, [plannedWorkout, exercises, isDirty, markSaved]);

  const handleDiscard = useCallback(() => {
    discardEdits();
    setSaveError(null);
    router.back();
  }, [discardEdits]);

  return (
    <WorkoutEditScreen
      workoutName={plannedWorkout?.name ?? 'Workout'}
      exercises={exercises}
      userId={user?.id}
      goal={user?.fitnessGoals?.[0]}
      programType={user?.metadata?.coachActivation?.programType}
      availableEquipment={user?.availableEquipment}
      unsavedChanges={isDirty}
      saving={saving}
      saveError={saveError}
      onChange={setExercises}
      onDone={handleDone}
      onDiscard={handleDiscard}
    />
  );
}
