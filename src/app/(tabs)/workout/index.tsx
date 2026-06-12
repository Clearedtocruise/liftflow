import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ActiveWorkoutScreen } from '@/components/workout/execution/ActiveWorkoutScreen';
import { WorkoutWeeklyPlanScreen } from '@/components/workout/execution/WorkoutWeeklyPlanScreen';
import { LiftFlowColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { enrichWithSupersetGroups } from '@/lib/supersetFlow';
import { buildWeekPlan, getWeekRange, isConditioningWorkout, type WeekDayPlan } from '@/lib/weekPlan';
import { coachActivationService } from '@/services/coachActivationService';
import { productAnalyticsService } from '@/services/productAnalyticsService';
import { socialShareService } from '@/services/socialShareService';
import { trainingService } from '@/services/trainingService';
import { useWorkoutPlanDraft } from '@/state/workout/WorkoutPlanDraftContext';
import { useWorkoutSession } from '@/state/workout/WorkoutSessionContext';

export default function WorkoutScreen() {
  const { user } = useAuth();
  const { exercises, setPlannedWorkout } = useWorkoutPlanDraft();
  const { activeSession: session, isLoading: loading, endSession, cancelSession } = useWorkoutSession();

  const [weekDays, setWeekDays] = useState<WeekDayPlan[]>([]);
  const [loadingPlan, setLoadingPlan] = useState(true);

  const loadWeekPlan = useCallback(async () => {
    if (!user?.id) {
      setLoadingPlan(false);
      return;
    }

    setLoadingPlan(true);
    const { from, to } = getWeekRange();
    const result = await trainingService.getPlannedWorkouts(user.id, from, to);
    const days = buildWeekPlan(result.success ? result.data : []);
    setWeekDays(days);
    const today = days.find((day) => day.workout && day.date === new Date().toISOString().slice(0, 10));
    if (today?.workout) setPlannedWorkout(today.workout);
    setLoadingPlan(false);
  }, [user?.id, setPlannedWorkout]);

  useEffect(() => {
    if (!user?.id) {
      setLoadingPlan(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      const regen = await trainingService.regenerateProgramIfNeeded(user.id);
      if (cancelled) return;
      if (regen.success && regen.data.regenerated) {
        await loadWeekPlan();
        return;
      }
      await loadWeekPlan();
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, loadWeekPlan]);

  const handleSelectDay = useCallback(
    (day: WeekDayPlan) => {
      if (day.workout && isConditioningWorkout(day.workout)) {
        router.push('/(features)/cardio-tracking');
        return;
      }
      if (!day.workout) return;
      setPlannedWorkout(day.workout);
      router.push({ pathname: '/(tabs)/workout/day', params: { id: day.workout.id } });
    },
    [setPlannedWorkout],
  );

  const handleConditioning = useCallback(() => {
    router.push('/(features)/cardio-tracking');
  }, []);

  const handleFinishWorkout = useCallback(async () => {
    const completed = await endSession();
    if (!completed || !user) return;
    void productAnalyticsService.trackWorkoutCompleted(user.id, completed.id);
    const coachResult = await coachActivationService.getPostWorkoutSummary(user.id, completed.id);
    const summary = coachResult.success ? coachResult.data : null;
    const body = summary
      ? `${summary.workoutSummary}\n\n${summary.recoveryRecommendation}\n\n${summary.nutritionRecommendation}`
      : `Duration: ${Math.round((completed.durationSeconds ?? 0) / 60)} min · ${completed.totalSets ?? 0} sets`;
    Alert.alert(summary ? 'Workout Complete' : 'Workout complete', body, [
      { text: 'Done', style: 'cancel' },
      { text: 'Share', onPress: () => socialShareService.shareWorkoutRecap(completed) },
    ]);
  }, [endSession, user]);

  if (loading && !session) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={LiftFlowColors.accent} />
      </View>
    );
  }

  if (session) {
    const planForSession = enrichWithSupersetGroups(
      exercises.length > 0
        ? exercises
        : [...session.exercises]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((exercise) => ({
              id: exercise.id,
              name: exercise.exercise?.name ?? 'Exercise',
              sets: Math.max(exercise.sets.length + 1, 3),
              repRange: exercise.suggestedReps ?? '8-10',
              restSeconds: 90,
            })),
    );

    return (
      <ActiveWorkoutScreen
        session={session}
        planExercises={planForSession}
        onFinish={handleFinishWorkout}
        onCancel={cancelSession}
      />
    );
  }

  return (
    <ScreenContainer contentContainerStyle={styles.content}>
      <WorkoutWeeklyPlanScreen
        days={weekDays}
        loading={loadingPlan}
        onSelectDay={handleSelectDay}
        onConditioning={handleConditioning}
        onManualLog={() => router.push('/(tabs)/workout/manual-log')}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LiftFlowColors.background,
  },
  content: {
    paddingBottom: 48,
  },
});
