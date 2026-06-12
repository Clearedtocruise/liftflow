import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { WorkoutDayOverviewScreen } from '@/components/workout/execution/WorkoutDayOverviewScreen';
import { LiftFlowColors } from '@/constants/theme';
import { pickDefaultLocation } from '@/constants/trainingProfile';
import { useAuth } from '@/hooks/useAuth';
import { useWorkoutLocations } from '@/hooks/useWorkoutLocations';
import { getWeekRange } from '@/lib/weekPlan';
import { exercisesFromPlannedWorkout } from '@/lib/workoutPlan';
import { trainingService } from '@/services/trainingService';
import { workoutService } from '@/services/workoutService';
import { useWorkoutPlanDraft } from '@/state/workout/WorkoutPlanDraftContext';
import { useWorkoutSession } from '@/state/workout/WorkoutSessionContext';
import type { PlannedWorkout } from '@/types/training';

export default function WorkoutDayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { exercises, setPlannedWorkout, setExercises } = useWorkoutPlanDraft();
  const { startSessionFromPlanned, refreshSession } = useWorkoutSession();
  const { locations, selectedId } = useWorkoutLocations(user?.id);

  const [workout, setWorkout] = useState<PlannedWorkout | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!user?.id || !id) return;
    let cancelled = false;

    const { from, to } = getWeekRange();
    void trainingService.getPlannedWorkouts(user.id, from, to).then((result) => {
      if (cancelled) return;
      const found = result.success ? result.data.find((item) => item.id === id) ?? null : null;
      if (found) {
        setWorkout(found);
        setPlannedWorkout(found);
        setExercises(exercisesFromPlannedWorkout(found));
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [user?.id, id, setPlannedWorkout, setExercises]);

  const handleStart = useCallback(async () => {
    if (!user || !workout) return;
    const location = pickDefaultLocation(locations, selectedId);
    setStarting(true);
    const started = await startSessionFromPlanned(workout.id, {
      name: workout.name,
      gymName: location?.name ?? user.primaryGymName ?? undefined,
      trainingLocation: location?.locationType ?? user.trainingLocation,
      workoutLocationId: location?.id,
    });
    if (started) {
      await workoutService.applySessionExercisePlan(started.id, user.id, exercises);
      await refreshSession();
      router.replace('/(tabs)/workout');
    }
    setStarting(false);
  }, [user, workout, locations, selectedId, exercises, startSessionFromPlanned, refreshSession]);

  if (loading || !workout) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={LiftFlowColors.accent} />
      </View>
    );
  }

  return (
    <WorkoutDayOverviewScreen
      workout={workout}
      exercises={exercises}
      starting={starting}
      onStart={handleStart}
      onEdit={() => router.push('/(tabs)/workout/edit')}
      onBack={() => router.back()}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LiftFlowColors.background,
  },
});
