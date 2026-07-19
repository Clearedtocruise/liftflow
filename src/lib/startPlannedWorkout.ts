import { Alert } from 'react-native';

import { pickDefaultLocation } from '@/constants/trainingProfile';
import { isConditioningWorkout } from '@/lib/weekPlan';
import { withTimeout } from '@/lib/withTimeout';
import { exercisesForSessionStart } from '@/lib/workoutPlan';
import type { StartSessionPayload, WorkoutSession } from '@/types';
import type { PlannedWorkout } from '@/types/training';
import type { UserProfile } from '@/types/user';
import type { EditableWorkoutExercise } from '@/types/workoutExecution';
import type { WorkoutLocation } from '@/types/workoutLocation';

type StartPlannedWorkoutParams = {
  user: UserProfile;
  planned: PlannedWorkout;
  tabataModeEnabled: boolean;
  locations: WorkoutLocation[];
  selectedLocationId: string | null;
  startSessionFromPlanned: (
    plannedWorkoutId: string,
    payload: StartSessionPayload,
  ) => Promise<WorkoutSession | null>;
  refreshSession: () => Promise<void>;
};

export type StartPlannedWorkoutResult = {
  session: WorkoutSession;
  sessionExercises: EditableWorkoutExercise[];
};

export async function startPlannedWorkout({
  user,
  planned,
  tabataModeEnabled,
  locations,
  selectedLocationId,
  startSessionFromPlanned,
  refreshSession,
}: StartPlannedWorkoutParams): Promise<StartPlannedWorkoutResult | null> {
  if (isConditioningWorkout(planned)) {
    Alert.alert('Cardio workout', 'Open the workout tab to log this cardio session.');
    return null;
  }

  const location = pickDefaultLocation(locations, selectedLocationId);
  const sessionExercises = exercisesForSessionStart(
    planned,
    tabataModeEnabled && !isConditioningWorkout(planned),
  );

  try {
    const started = await withTimeout(
      startSessionFromPlanned(planned.id, {
        name: planned.name,
        gymName: location?.name ?? user.primaryGymName ?? undefined,
        trainingLocation: location?.locationType ?? user.trainingLocation,
        workoutLocationId: location?.id,
        exercisePlan: sessionExercises,
      }),
      45_000,
      'start workout',
    );

    if (!started) {
      Alert.alert('Could not start workout', 'Please check your connection and try again.');
      return null;
    }

    await withTimeout(refreshSession(), 8_000, 'refresh workout session').catch(() => undefined);
    return { session: started, sessionExercises };
  } catch (error) {
    // Hydrate may still recover an in-progress session after a slow start/resume.
    await withTimeout(refreshSession(), 8_000, 'refresh workout session').catch(() => undefined);
    Alert.alert(
      'Restoring workout',
      error instanceof Error
        ? `${error.message}. If a workout is already in progress, open the Workout tab to continue.`
        : 'If a workout is already in progress, open the Workout tab to continue.',
    );
    return null;
  }
}
