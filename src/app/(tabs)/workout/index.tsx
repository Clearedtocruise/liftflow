import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

import { HomePlanAdjustedBanner } from '@/components/dashboard/HomePlanAdjustedBanner';
import { ManageDayModal } from '@/components/dashboard/ManageDayModal';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SkeletonBlock } from '@/components/layout/SkeletonBlock';
import { TabScreenHeader } from '@/components/layout/TabScreenHeader';
import { ActiveWorkoutScreen } from '@/components/workout/execution/ActiveWorkoutScreen';
import { WorkoutExecutionErrorBoundary } from '@/components/workout/execution/WorkoutExecutionErrorBoundary';
import { WorkoutWeeklyPlanScreen } from '@/components/workout/execution/WorkoutWeeklyPlanScreen';
import { HeroImages } from '@/constants/imagery';
import { usePlanAdjustment } from '@/contexts/PlanAdjustmentContext';
import { useAppResume } from '@/hooks/useAppResume';
import { useAuth } from '@/hooks/useAuth';
import { useLocalDayRollover } from '@/hooks/useLocalDayRollover';
import { useLocalWeekRollover } from '@/hooks/useLocalWeekRollover';
import { useTabataModePreference } from '@/hooks/useTabataModePreference';
import {
    resolveActiveTrainingDay,
    validateWorkoutAssignmentConsistency,
} from '@/lib/activeTrainingDay';
import { localDateString } from '@/lib/localDate';
import { planDataCache } from '@/lib/planDataCache';
import { warmWeekPlanData } from '@/lib/planDataPrefetch';
import { buildEditDayMenu, type ManageDayMenuContent } from '@/lib/planDayActions';
import { logStartup } from '@/lib/startupLogger';
import { inferExecutionModeFromPlan } from '@/lib/supersetFlow';
import { buildWeekPlan, getWeekRange, isConditioningWorkout, type WeekDayPlan } from '@/lib/weekPlan';
import { serializeChallengeNotes } from '@/lib/workoutChallengeFlow';
import { normalizeExecutionMode } from '@/lib/workoutExecutionMode';
import { buildPlanExercisesFromSession, resolvePlannedWorkoutForSession } from '@/lib/workoutPlan';
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
  const { tabataModeEnabled } = useTabataModePreference();
  const { activeSession: session, isLoading: loading, endSession, cancelSession, refreshSession } = useWorkoutSession();

  const [weekDays, setWeekDays] = useState<WeekDayPlan[]>([]);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [refreshingPlan, setRefreshingPlan] = useState(false);
  const [adaptingPlan, setAdaptingPlan] = useState(false);
  const [editDayOpen, setEditDayOpen] = useState(false);
  const [editDayMenu, setEditDayMenu] = useState<ManageDayMenuContent | null>(null);
  const [challengeRecords, setChallengeRecords] = useState<WorkoutChallengeRecord[]>([]);
  const loadGenerationRef = useRef(0);
  const hydratedFromCacheRef = useRef(false);
  const skipFocusLoadRef = useRef(true);

  const loadWeekPlan = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!user?.id) {
        setLoadingPlan(false);
        return;
      }

      const generation = ++loadGenerationRef.current;
      const silent = options?.silent ?? (weekDays.length > 0 || hydratedFromCacheRef.current);

      if (!silent) setLoadingPlan(true);
      else setRefreshingPlan(true);

      try {
        const { from, to } = getWeekRange(new Date(), user?.timezone);
        const result = await trainingService.getPlannedWorkouts(user.id, from, to, user.timezone);
        if (generation !== loadGenerationRef.current) return;

        const days = buildWeekPlan(result.success ? result.data : [], new Date(), user?.timezone);
        setWeekDays(days);
        if (result.success) {
          void planDataCache.writeWorkouts(user.id, from, to, result.data);
          logStartup('WORKOUT_PLAN_LOADED', { count: result.data.length, source: 'workout-tab' });
        }

        const todayKey = localDateString(new Date(), user?.timezone);
        const today = days.find((day) => day.date === todayKey);
        if (today?.workout && !session) setPlannedWorkout(today.workout);
      } catch (error) {
        console.warn('[workout] week plan load failed', error);
        if (!silent) setWeekDays([]);
      } finally {
        if (generation === loadGenerationRef.current) {
          setLoadingPlan(false);
          setRefreshingPlan(false);
        }
      }
    },
    [user?.id, user?.timezone, setPlannedWorkout, weekDays.length, session],
  );

  useLocalDayRollover(user?.timezone, () => {
    void loadWeekPlan({ silent: true });
  });

  useLocalWeekRollover(user?.timezone, () => {
    if (!user?.id) return;
    void loadWeekPlan({ silent: true });
    void trainingService.regenerateProgramIfNeeded(user.id).then((regen) => {
      if (regen.success && regen.data.regenerated) void loadWeekPlan({ silent: true });
    });
  });

  useEffect(() => {
    if (!user?.id) {
      setLoadingPlan(false);
      return;
    }

    let cancelled = false;
    const { from, to } = getWeekRange(new Date(), user?.timezone);

    void (async () => {
      const cached = await planDataCache.readWeek(user.id, from, to);
      if (cancelled) return;

      if (cached.workouts.length > 0) {
        const days = buildWeekPlan(cached.workouts, new Date(), user?.timezone);
        setWeekDays(days);
        setLoadingPlan(false);
        hydratedFromCacheRef.current = true;

        const todayKey = localDateString(new Date(), user?.timezone);
        const today = days.find((day) => day.date === todayKey);
        if (today?.workout && !session) setPlannedWorkout(today.workout);
      }

      void warmWeekPlanData(user.id, user?.timezone);
      void loadWeekPlan({ silent: hydratedFromCacheRef.current });
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.timezone, loadWeekPlan, setPlannedWorkout, session]);

  useFocusEffect(
    useCallback(() => {
      if (skipFocusLoadRef.current) {
        skipFocusLoadRef.current = false;
        return;
      }
      if (user?.id) void loadWeekPlan({ silent: true });
      if (session) void refreshSession();
    }, [user?.id, loadWeekPlan, session, refreshSession]),
  );

  useAppResume(() => {
    if (user?.id) void loadWeekPlan({ silent: true });
    if (session) void refreshSession();
  });

  useEffect(() => {
    if (revision > 0 && user?.id) void loadWeekPlan({ silent: true });
  }, [revision, user?.id, loadWeekPlan]);

  const weekWorkouts = useMemo(
    () => weekDays.map((day) => day.workout).filter(Boolean) as PlannedWorkout[],
    [weekDays],
  );

  const plannedForActiveSession = useMemo(() => {
    if (!session) return null;
    return resolvePlannedWorkoutForSession(session, weekWorkouts, plannedWorkout);
  }, [session, weekWorkouts, plannedWorkout]);

  useEffect(() => {
    if (!__DEV__ || !user?.id) return;
    const todayKey = localDateString(new Date(), user.timezone);
    const homeDay = resolveActiveTrainingDay(weekWorkouts, { date: todayKey, timeZone: user.timezone });
    const plannerDay = weekDays.find((day) => day.date === todayKey);
    const mismatches = validateWorkoutAssignmentConsistency({
      workoutTab: homeDay,
      planner: plannerDay?.workout
        ? resolveActiveTrainingDay(weekWorkouts, { date: todayKey, timeZone: user.timezone })
        : homeDay,
    });
    if (mismatches.length > 0) {
      console.warn('[activeTrainingDay] workout tab mismatch', mismatches);
    }
  }, [user?.id, user?.timezone, weekDays, weekWorkouts]);

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

      const planDeps = {
        userId: user.id,
        workouts: weekWorkouts,
        setFromAdaptation,
        onWorkoutsUpdated: (workouts: PlannedWorkout[]) => {
          setWeekDays(buildWeekPlan(workouts, new Date(), user.timezone));
        },
        onComplete: () => void loadWeekPlan({ silent: true }),
        onBusyChange: setAdaptingPlan,
        timeZone: user.timezone,
      };

      const menu = buildEditDayMenu(planDeps, day.date, {
        onEditExercises: day.workout
          ? () => {
              setEditDayOpen(false);
              setEditDayMenu(null);
              setPlannedWorkout(day.workout!);
              router.push({ pathname: '/(tabs)/workout/day', params: { id: day.workout!.id } });
            }
          : undefined,
        onStartWorkout: day.workout
          ? () => {
              setEditDayOpen(false);
              setEditDayMenu(null);
              handleSelectDay(day);
            }
          : undefined,
      });

      if (!menu) {
        Alert.alert('Edit Day', 'No workouts available to adjust this week.');
        return;
      }

      setEditDayMenu(menu);
      setEditDayOpen(true);
    },
    [user?.id, user?.timezone, weekWorkouts, setFromAdaptation, loadWeekPlan, handleSelectDay, setPlannedWorkout],
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

  if (loading && !session && loadingPlan && weekDays.length === 0) {
    return (
      <ScreenContainer
        header={<TabScreenHeader title="Workout" subtitle="This week's plan" showBrand={false} bannerUri={HeroImages.tabs.workout} />}
        scroll={false}>
        <SkeletonBlock height={120} />
        <SkeletonBlock height={200} />
        <SkeletonBlock height={200} />
      </ScreenContainer>
    );
  }

  if (session) {
    const sessionTabata =
      tabataModeEnabled &&
      plannedForActiveSession != null &&
      !isConditioningWorkout(plannedForActiveSession);

    const planForSession = buildPlanExercisesFromSession(
      session,
      plannedForActiveSession,
      sessionTabata,
    );

    const executionMode = inferExecutionModeFromPlan(
      planForSession,
      normalizeExecutionMode(
        planForSession[0]?.executionMode ??
          plannedForActiveSession?.metadata?.executionMode ??
          (sessionTabata ? 'tabata' : undefined),
      ),
    );

    return (
      <WorkoutExecutionErrorBoundary
        onResume={() => void refreshSession()}
        onEndWorkout={handleFinishWorkout}>
        <ActiveWorkoutScreen
          session={session}
          planExercises={planForSession}
          executionMode={executionMode}
          challengeRecords={challengeRecords}
          onChallengeRecord={handleChallengeRecord}
          onFinish={handleFinishWorkout}
          onCancel={cancelSession}
        />
      </WorkoutExecutionErrorBoundary>
    );
  }

  return (
    <ScreenContainer
      header={<TabScreenHeader title="Workout" subtitle="This week's plan" showBrand={false} bannerUri={HeroImages.tabs.workout} />}
      contentContainerStyle={styles.content}>
      <HomePlanAdjustedBanner />
      <WorkoutWeeklyPlanScreen
        days={weekDays}
        loading={loadingPlan}
        refreshing={refreshingPlan}
        adaptingPlan={adaptingPlan}
        timeZone={user?.timezone}
        onSelectDay={handleSelectDay}
        onEditDay={handleEditDay}
        onManualLog={() => router.push('/(tabs)/workout/manual-log')}
        onCardio={() => router.push('/(features)/cardio-tracking')}
      />

      {editDayMenu ? (
        <ManageDayModal
          visible={editDayOpen}
          title={editDayMenu.title}
          showWeekList={editDayMenu.showWeekList}
          weeklyPlan={editDayMenu.weeklyPlan}
          focusDate={editDayMenu.focusDate}
          todayLabel={editDayMenu.todayLabel}
          focusWorkoutId={editDayMenu.focusWorkoutId}
          actions={editDayMenu.actions}
          swapTargets={editDayMenu.swapTargets}
          moveTargets={editDayMenu.moveTargets}
          restDayTargets={editDayMenu.restDayTargets}
          doTodayTargets={editDayMenu.doTodayTargets}
          onScheduleChange={editDayMenu.onScheduleChange}
          onClose={() => {
            setEditDayOpen(false);
            setEditDayMenu(null);
          }}
        />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 48,
  },
});
