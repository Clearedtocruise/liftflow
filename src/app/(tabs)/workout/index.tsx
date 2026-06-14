import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ActiveWorkoutScreen } from '@/components/workout/execution/ActiveWorkoutScreen';
import { WorkoutWeeklyPlanScreen } from '@/components/workout/execution/WorkoutWeeklyPlanScreen';
import { LiftFlowColors } from '@/constants/theme';
import { usePlanAdjustment } from '@/contexts/PlanAdjustmentContext';
import { useAuth } from '@/hooks/useAuth';
import { localDateString } from '@/lib/localDate';
import { showWeeklyEditDayMenu } from '@/lib/planDayActions';
import { enrichWithSupersetGroups } from '@/lib/supersetFlow';
import { buildWeekPlan, getWeekRange, isConditioningWorkout, type WeekDayPlan } from '@/lib/weekPlan';
import { serializeChallengeNotes } from '@/lib/workoutChallengeFlow';
import { normalizeExecutionMode } from '@/lib/workoutExecutionMode';
import { productAnalyticsService } from '@/services/productAnalyticsService';
import { trainingService } from '@/services/trainingService';
import { workoutService } from '@/services/workoutService';
import { useWorkoutPlanDraft } from '@/state/workout/WorkoutPlanDraftContext';
import { useWorkoutSession } from '@/state/workout/WorkoutSessionContext';
import type { PlannedWorkout } from '@/types/training';
import type { WorkoutChallengeRecord } from '@/types/workoutChallenge';

export default function WorkoutScreen() {
  const { user } = useAuth();
  const { revision, setFromAdaptation } = usePlanAdjustment();
  const { exercises, setPlannedWorkout, plannedWorkout } = useWorkoutPlanDraft();
  const { activeSession: session, isLoading: loading, endSession, cancelSession } = useWorkoutSession();

  const [weekDays, setWeekDays] = useState<WeekDayPlan[]>([]);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [refreshingPlan, setRefreshingPlan] = useState(false);
  const [adaptingPlan, setAdaptingPlan] = useState(false);
  const [challengeRecords, setChallengeRecords] = useState<WorkoutChallengeRecord[]>([]);

  const loadWeekPlan = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!user?.id) {
        setLoadingPlan(false);
        return;
      }

      if (options?.silent) setRefreshingPlan(true);
      else setLoadingPlan(true);

      try {
        const { from, to } = getWeekRange(new Date(), user?.timezone);
        const result = await trainingService.getPlannedWorkouts(user.id, from, to, user.timezone);
        const days = buildWeekPlan(result.success ? result.data : []);
        setWeekDays(days);
        const today = days.find((day) => day.workout && day.date === localDateString());
        if (today?.workout) setPlannedWorkout(today.workout);
      } catch {
        if (!options?.silent) setWeekDays([]);
      } finally {
        setLoadingPlan(false);
        setRefreshingPlan(false);
      }
    },
    [user?.id, setPlannedWorkout],
  );

  useEffect(() => {
    if (!user?.id) {
      setLoadingPlan(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        await loadWeekPlan();
        if (cancelled) return;

        const regen = await trainingService.regenerateProgramIfNeeded(user.id);
        if (cancelled) return;
        if (regen.success && regen.data.regenerated) {
          await loadWeekPlan({ silent: true });
        }
      } catch {
        if (!cancelled) setLoadingPlan(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, loadWeekPlan]);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) void loadWeekPlan({ silent: true });
    }, [user?.id, loadWeekPlan]),
  );

  useEffect(() => {
    if (revision > 0 && user?.id) void loadWeekPlan({ silent: true });
  }, [revision, user?.id, loadWeekPlan]);

  const weekWorkouts = useMemo(
    () => weekDays.map((day) => day.workout).filter(Boolean) as PlannedWorkout[],
    [weekDays],
  );

  const handleSelectDay = useCallback(
    (day: WeekDayPlan) => {
      if (day.workout && isConditioningWorkout(day.workout)) {
        router.push('/(features)/cardio-tracking');
        return;
      }
      if (day.workout) {
        setPlannedWorkout(day.workout);
        router.push({ pathname: '/(tabs)/workout/day', params: { id: day.workout.id } });
        return;
      }
      router.push({
        pathname: '/(tabs)/workout/rest-day',
        params: { date: day.date, label: day.dayLabel },
      });
    },
    [setPlannedWorkout],
  );

  const handleEditDay = useCallback(
    (day: WeekDayPlan) => {
      if (!user?.id) return;
      showWeeklyEditDayMenu(
        {
          userId: user.id,
          workouts: weekWorkouts,
          setFromAdaptation,
          onComplete: () => void loadWeekPlan({ silent: true }),
          onBusyChange: setAdaptingPlan,
          timeZone: user.timezone,
        },
        day.date,
        day.workout ? () => handleSelectDay(day) : undefined,
      );
    },
    [user?.id, weekWorkouts, setFromAdaptation, loadWeekPlan, handleSelectDay],
  );

  const handleFinishWorkout = useCallback(async () => {
    const completed = await endSession();
    if (!completed || !user) return;

    if (challengeRecords.length > 0) {
      const notes = serializeChallengeNotes(challengeRecords);
      if (notes) {
        await workoutService.updateSession(completed.id, { notes });
      }
    }

    void productAnalyticsService.trackWorkoutCompleted(user.id, completed.id);
    const challengesPayload = challengeRecords;
    setChallengeRecords([]);

    router.push({
      pathname: '/(tabs)/workout/summary',
      params: {
        sessionId: completed.id,
        challenges: JSON.stringify(challengesPayload),
      },
    });
  }, [challengeRecords, endSession, user]);

  const handleChallengeRecord = useCallback((record: WorkoutChallengeRecord) => {
    setChallengeRecords((current) => [...current, record]);
  }, []);

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

    const executionMode = normalizeExecutionMode(
      plannedWorkout?.metadata?.executionMode ?? exercises[0]?.executionMode,
    );

    return (
      <ActiveWorkoutScreen
        session={session}
        planExercises={planForSession}
        executionMode={executionMode}
        challengeRecords={challengeRecords}
        onChallengeRecord={handleChallengeRecord}
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
        refreshing={refreshingPlan}
        adaptingPlan={adaptingPlan}
        onSelectDay={handleSelectDay}
        onEditDay={handleEditDay}
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
