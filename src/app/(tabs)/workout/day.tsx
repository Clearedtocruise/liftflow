import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { ErrorStateCard } from '@/components/layout/StateCard';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { WorkoutDayOverviewScreen } from '@/components/workout/execution/WorkoutDayOverviewScreen';
import { LiftFlowColors } from '@/constants/theme';
import { pickDefaultLocation } from '@/constants/trainingProfile';
import { useAuth } from '@/hooks/useAuth';
import { useTabataModePreference } from '@/hooks/useTabataModePreference';
import { useWorkoutLocations } from '@/hooks/useWorkoutLocations';
import { profileFigureGender } from '@/lib/exerciseMuscleMap';
import { isSelfDirectedTraining } from '@/lib/selfDirectedMode';
import { isConditioningWorkout } from '@/lib/weekPlan';
import { exercisesForSessionStart } from '@/lib/workoutPlan';
import type { ExerciseAlternativeOption } from '@/services/exerciseAdvisoryService';
import { trainingService } from '@/services/trainingService';
import { workoutService } from '@/services/workoutService';
import { useWorkoutPlanDraft } from '@/state/workout/WorkoutPlanDraftContext';
import { useWorkoutSession } from '@/state/workout/WorkoutSessionContext';
import type { PlannedWorkout } from '@/types/training';

export default function WorkoutDayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { tabataModeEnabled } = useTabataModePreference();
  const {
    plannedWorkout: draftWorkout,
    exercises,
    isDirty,
    setPlannedWorkout,
    setExercises,
    setSessionPlan,
    markSaved,
  } = useWorkoutPlanDraft();
  const { startSessionFromPlanned, refreshSession } = useWorkoutSession();
  const { locations, selectedId } = useWorkoutLocations(user?.id);

  const [loaded, setLoaded] = useState<PlannedWorkout | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const ownWorkouts = isSelfDirectedTraining(user);

  /**
   * The draft context holds the newest copy of this workout, because saving from the edit screen
   * updates it there. Reading the locally loaded copy instead would start the session from the
   * pre-edit exercises.
   */
  const workout = draftWorkout?.id === loaded?.id ? (draftWorkout ?? loaded) : loaded;
  const workoutUnavailable = Boolean(loaded && loaded.status === 'cancelled');

  const loadWorkout = useCallback(async () => {
    if (!user?.id || !id) {
      setLoading(false);
      return;
    }

    // Self-directed athletes log freely — old coached day deep links should not trap them.
    if (isSelfDirectedTraining(user)) {
      setLoading(false);
      router.replace('/(tabs)/workout/manual-log');
      return;
    }

    setLoading(true);
    setLoadError(null);

    // Load by id (not "this week"), so timezone edges / plan reloads don't false-miss.
    const result = await trainingService.getPlannedWorkoutById(user.id, id);

    if (!result.success) {
      setLoadError(result.error);
      setLoaded(null);
      setLoading(false);
      return;
    }

    const found = result.data;
    if (found && found.status !== 'cancelled') {
      setLoaded(found);
      // `setPlannedWorkout` seeds the exercises itself, and keeps unsaved edits for this workout.
      // Following it with `setExercises(exercisesFromPlannedWorkout(found))` overwrote them.
      setPlannedWorkout(found);
    } else {
      setLoaded(found);
    }
    setLoading(false);
  }, [user, id, setPlannedWorkout]);

  useEffect(() => {
    void loadWorkout();
  }, [loadWorkout]);

  const handleStart = useCallback(async () => {
    if (!user || !workout) return;
    const location = pickDefaultLocation(locations, selectedId);
    setStarting(true);

    // The session is built from the planned workout in the database, not from the draft, so unsaved
    // edits used to be silently dropped by starting the workout.
    let planned = workout;
    if (isDirty) {
      const saved = await trainingService.updatePlannedWorkoutExercises(
        workout.id,
        exercises,
        workout.metadata,
      );
      if (!saved.success) {
        Alert.alert('Could not save your changes', saved.error || 'Please try again.');
        setStarting(false);
        return;
      }
      planned = saved.data;
      setLoaded(planned);
      markSaved(planned);
    }

    const started = await startSessionFromPlanned(planned.id, {
      name: planned.name,
      gymName: location?.name ?? user.primaryGymName ?? undefined,
      trainingLocation: location?.locationType ?? user.trainingLocation,
      workoutLocationId: location?.id,
    });
    if (started) {
      const sessionExercises = exercisesForSessionStart(
        planned,
        tabataModeEnabled && !isConditioningWorkout(planned),
      );
      setSessionPlan(sessionExercises);
      await workoutService.applySessionExercisePlan(started.id, user.id, sessionExercises);
      await refreshSession();
      router.replace('/(tabs)/workout');
    }
    setStarting(false);
  }, [
    user,
    workout,
    exercises,
    isDirty,
    locations,
    selectedId,
    tabataModeEnabled,
    markSaved,
    setSessionPlan,
    startSessionFromPlanned,
    refreshSession,
  ]);

  const handleReplaceExercise = useCallback(
    async (index: number, option: ExerciseAlternativeOption) => {
      if (!workout || index < 0 || index >= exercises.length) return;
      const previousExercises = exercises;
      const nextExercises = exercises.map((exercise, exerciseIndex) =>
        exerciseIndex === index
          ? {
              ...exercise,
              id: `plan-${index}-${option.name.toLowerCase().replace(/\s+/g, '-')}`,
              name: option.name,
            }
          : exercise,
      );
      setExercises(nextExercises);
      try {
        const result = await trainingService.updatePlannedWorkoutExercises(
          workout.id,
          nextExercises,
          workout.metadata,
        );
        if (result.success) {
          setLoaded(result.data);
          markSaved(result.data);
        } else {
          setExercises(previousExercises);
        }
      } catch {
        setExercises(previousExercises);
      }
    },
    [workout, exercises, setExercises, markSaved],
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={LiftFlowColors.accent} />
      </View>
    );
  }

  if (loadError) {
    return (
      <ScreenContainer contentContainerStyle={styles.centeredContent}>
        <ErrorStateCard
          title="Could not load workout"
          message={loadError}
          onRetry={() => void loadWorkout()}
          onBack={() => router.replace('/(tabs)/workout')}
          backLabel="Back to weekly plan"
        />
      </ScreenContainer>
    );
  }

  if (!workout || workoutUnavailable) {
    return (
      <ScreenContainer contentContainerStyle={styles.centeredContent}>
        <ErrorStateCard
          title="Workout not found"
          message={
            ownWorkouts
              ? 'Coach week planning is off. Log your own workout instead.'
              : 'This workout may have been replaced when your plan updated, or removed from your week.'
          }
          onBack={() => router.replace('/(tabs)/workout')}
          backLabel="Back to weekly plan"
          onRetry={() => router.push('/(tabs)/workout/manual-log')}
          retryLabel="Log my workout"
        />
      </ScreenContainer>
    );
  }

  return (
    <WorkoutDayOverviewScreen
      workout={workout}
      exercises={exercises}
      userId={user?.id}
      goal={user?.fitnessGoals?.[0]}
      programType={user?.metadata?.coachActivation?.programType}
      availableEquipment={user?.availableEquipment}
      gender={profileFigureGender(user?.sex)}
      starting={starting}
      onStart={handleStart}
      onEdit={() => router.push('/(tabs)/workout/edit')}
      onBack={() => router.back()}
      onReplaceExercise={handleReplaceExercise}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LiftFlowColors.background,
  },
  centeredContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});
