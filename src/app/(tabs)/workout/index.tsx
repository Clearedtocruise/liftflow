import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { ActiveWorkoutScreen } from '@/components/workout/execution/ActiveWorkoutScreen';
import { WorkoutOverviewScreen } from '@/components/workout/execution/WorkoutOverviewScreen';
import { LiftFlowColors } from '@/constants/theme';
import { buildWorkoutSessionName, pickDefaultLocation } from '@/constants/trainingProfile';
import { useAuth } from '@/hooks/useAuth';
import { useNearbyWorkoutLocation } from '@/hooks/useNearbyWorkoutLocation';
import { useWorkoutLocations } from '@/hooks/useWorkoutLocations';
import { coachActivationService } from '@/services/coachActivationService';
import { productAnalyticsService } from '@/services/productAnalyticsService';
import { socialShareService } from '@/services/socialShareService';
import { trainingService } from '@/services/trainingService';
import { workoutService } from '@/services/workoutService';
import { useWorkoutPlanDraft } from '@/state/workout/WorkoutPlanDraftContext';
import { useWorkoutSession } from '@/state/workout/WorkoutSessionContext';

export default function WorkoutScreen() {
  const { user } = useAuth();
  const { plannedWorkout, exercises, setPlannedWorkout } = useWorkoutPlanDraft();
  const {
    activeSession: session,
    isLoading: loading,
    startSessionFromPlanned,
    endSession,
    cancelSession,
    refreshSession,
  } = useWorkoutSession();

  const { locations, selectedId, setSelectedId, loading: locationsLoading } = useWorkoutLocations(user?.id);
  const nearby = useNearbyWorkoutLocation({
    userId: user?.id,
    locations,
    enabled: session === null && !loading,
    onMatch: (match) => {
      if (match) setSelectedId(match.location.id);
    },
  });

  const [loadingPlan, setLoadingPlan] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setLoadingPlan(false);
      return;
    }

    let cancelled = false;
    void trainingService.getDashboard(user.id).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setPlannedWorkout(result.data.nextWorkout);
      }
      setLoadingPlan(false);
    });

    return () => {
      cancelled = true;
    };
  }, [user?.id, setPlannedWorkout]);

  const handleStartWorkout = useCallback(async () => {
    if (!user) return;

    const location = pickDefaultLocation(locations, selectedId);
    const payload = {
      name: plannedWorkout?.name ?? buildWorkoutSessionName(user, location),
      gymName: location?.name ?? user.primaryGymName ?? undefined,
      trainingLocation: location?.locationType ?? user.trainingLocation,
      workoutLocationId: location?.id,
    };

    setStarting(true);

    if (!plannedWorkout || exercises.length === 0) {
      setStarting(false);
      router.push('/(tabs)/workout/manual-log');
      return;
    }

    const started = await startSessionFromPlanned(plannedWorkout.id, payload);
    if (started) {
      const synced = await workoutService.applySessionExercisePlan(started.id, user.id, exercises);
      if (synced.success) {
        await refreshSession();
      }
    } else {
      Alert.alert('Could not start', 'Unable to start workout session.');
    }

    setStarting(false);
  }, [
    user,
    locations,
    selectedId,
    plannedWorkout,
    exercises,
    startSessionFromPlanned,
    refreshSession,
  ]);

  const handleFinishWorkout = useCallback(async () => {
    const completed = await endSession();
    if (!completed || !user) return;

    void productAnalyticsService.trackWorkoutCompleted(user.id, completed.id);

    const coachResult = await coachActivationService.getPostWorkoutSummary(user.id, completed.id);
    const summary = coachResult.success ? coachResult.data : null;

    const body = summary
      ? `${summary.workoutSummary}\n\n${summary.recoveryRecommendation}\n\n${summary.nutritionRecommendation}\n\n${summary.progressionRecommendations[0] ?? ''}`
      : `Duration: ${Math.round((completed.durationSeconds ?? 0) / 60)} min · ${completed.totalSets ?? 0} sets`;

    Alert.alert(summary ? 'Workout Complete — AI Coach' : 'Workout complete', body, [
      { text: 'Done', style: 'cancel' },
      {
        text: 'Share',
        onPress: () => socialShareService.shareWorkoutRecap(completed),
      },
    ]);
  }, [endSession, user]);

  const handleCancelWorkout = useCallback(async () => {
    await cancelSession();
  }, [cancelSession]);

  if (loading && !session) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={LiftFlowColors.accent} />
      </View>
    );
  }

  if (session) {
    const planForSession =
      exercises.length > 0
        ? exercises
        : [...session.exercises]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((exercise) => ({
              id: exercise.id,
              name: exercise.exercise?.name ?? 'Exercise',
              sets: Math.max(exercise.sets.length + 1, 3),
              repRange: exercise.suggestedReps ?? '8-10',
            }));

    return (
      <ActiveWorkoutScreen
        session={session}
        planExercises={planForSession}
        onFinish={handleFinishWorkout}
        onCancel={handleCancelWorkout}
      />
    );
  }

  return (
    <WorkoutOverviewScreen
      user={user}
      plannedWorkout={plannedWorkout}
      exercises={exercises}
      loadingPlan={loadingPlan}
      starting={starting}
      locations={locations}
      selectedLocationId={selectedId}
      onSelectLocation={setSelectedId}
      locationsLoading={locationsLoading}
      nearbyMatch={nearby.nearestMatch}
      locationChecking={nearby.checking}
      onEnableLocation={
        nearby.detectionEnabled && nearby.permissionStatus !== 'granted' ? nearby.requestPermission : undefined
      }
      onStart={handleStartWorkout}
      onEdit={() => router.push('/(tabs)/workout/edit')}
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
