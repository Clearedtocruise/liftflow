import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ErrorStateCard } from '@/components/layout/StateCard';
import { WorkoutDayOverviewScreen } from '@/components/workout/execution/WorkoutDayOverviewScreen';
import { LiftFlowColors } from '@/constants/theme';
import { pickDefaultLocation } from '@/constants/trainingProfile';
import { useAuth } from '@/hooks/useAuth';
import { useTabataModePreference } from '@/hooks/useTabataModePreference';
import { useWorkoutLocations } from '@/hooks/useWorkoutLocations';
import { profileFigureGender } from '@/lib/exerciseMuscleMap';
import { getWeekRange, isConditioningWorkout } from '@/lib/weekPlan';
import { exercisesForSessionStart, exercisesFromPlannedWorkout } from '@/lib/workoutPlan';
import type { ExerciseAlternativeOption } from '@/services/exerciseAdvisoryService';
import { trainingService } from '@/services/trainingService';
import { useWorkoutPlanDraft } from '@/state/workout/WorkoutPlanDraftContext';
import { useWorkoutSession } from '@/state/workout/WorkoutSessionContext';
import type { PlannedWorkout } from '@/types/training';

export default function WorkoutDayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { tabataModeEnabled } = useTabataModePreference();
  const { exercises, setPlannedWorkout, setExercises } = useWorkoutPlanDraft();
  const { startSessionFromPlanned, refreshSession } = useWorkoutSession();
  const { locations, selectedId } = useWorkoutLocations(user?.id);

  const [workout, setWorkout] = useState<PlannedWorkout | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const loadWorkout = useCallback(async () => {
    if (!user?.id || !id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);

    const { from, to } = getWeekRange();
    const result = await trainingService.getPlannedWorkouts(user.id, from, to);

    if (!result.success) {
      setLoadError(result.error);
      setWorkout(null);
      setLoading(false);
      return;
    }

    const found = result.data.find((item) => item.id === id) ?? null;
    if (found) {
      setWorkout(found);
      setPlannedWorkout(found);
      setExercises(exercisesFromPlannedWorkout(found));
    } else {
      setWorkout(null);
    }
    setLoading(false);
  }, [user?.id, id, setPlannedWorkout, setExercises]);

  useEffect(() => {
    void loadWorkout();
  }, [loadWorkout]);

  const handleStart = useCallback(async () => {
    if (!user || !workout) return;
    const location = pickDefaultLocation(locations, selectedId);
    const sessionExercises = exercisesForSessionStart(
      workout,
      tabataModeEnabled && !isConditioningWorkout(workout),
    );
    setStarting(true);
    const started = await startSessionFromPlanned(workout.id, {
      name: workout.name,
      gymName: location?.name ?? user.primaryGymName ?? undefined,
      trainingLocation: location?.locationType ?? user.trainingLocation,
      workoutLocationId: location?.id,
      exercisePlan: sessionExercises,
    });
    if (started) {
      setExercises(sessionExercises);
      await refreshSession();
      router.replace('/(tabs)/workout');
    }
    setStarting(false);
  }, [user, workout, locations, selectedId, tabataModeEnabled, setExercises, startSessionFromPlanned, refreshSession]);

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
          setWorkout(result.data);
          setPlannedWorkout(result.data);
          setExercises(exercisesFromPlannedWorkout(result.data));
        } else {
          setExercises(previousExercises);
        }
      } catch {
        setExercises(previousExercises);
      }
    },
    [workout, exercises, setExercises, setPlannedWorkout],
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

  if (!workout) {
    return (
      <ScreenContainer contentContainerStyle={styles.centeredContent}>
        <ErrorStateCard
          title="Workout not found"
          message="This workout may have been moved, completed, or removed from your plan."
          onBack={() => router.replace('/(tabs)/workout')}
          backLabel="Back to weekly plan"
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
