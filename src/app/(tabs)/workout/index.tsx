import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { ManageDayModal } from '@/components/dashboard/ManageDayModal';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ErrorStateCard } from '@/components/layout/StateCard';
import { ActiveWorkoutScreen } from '@/components/workout/execution/ActiveWorkoutScreen';
import { WorkoutWeeklyPlanScreen } from '@/components/workout/execution/WorkoutWeeklyPlanScreen';
import { LiftFlowColors } from '@/constants/theme';
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
import { INTERVAL_MODE_DEFAULTS } from '@/constants/workoutExecutionModes';
import { localDateString } from '@/lib/localDate';
import { planDataCache } from '@/lib/planDataCache';
import { warmWeekPlanData } from '@/lib/planDataPrefetch';
import { buildEditDayMenu, type ManageDayMenuContent } from '@/lib/planDayActions';
import { logStartup } from '@/lib/startupLogger';
import { enrichWithSupersetGroups, inferExecutionModeFromPlan } from '@/lib/supersetFlow';
import {
  buildWeekPlan,
  conditioningActivityId,
  getWeekRange,
  isConditioningWorkout,
  type WeekDayPlan,
} from '@/lib/weekPlan';
import { serializeChallengeNotes } from '@/lib/workoutChallengeFlow';
import { normalizeExecutionMode } from '@/lib/workoutExecutionMode';
import { exercisesForSessionStart } from '@/lib/workoutPlan';
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
  const [planError, setPlanError] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const finishingRef = useRef(false);
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

        // A failed fetch used to render as a legitimately empty week, so the user was told they
        // had no training scheduled when in fact the request never came back.
        setPlanError(!result.success);
        const days = buildWeekPlan(result.success ? result.data : [], new Date(), user?.timezone);
        setWeekDays(days);
        if (result.success) {
          void planDataCache.writeWorkouts(user.id, from, to, result.data);
          logStartup('WORKOUT_PLAN_LOADED', { count: result.data.length, source: 'workout-tab' });
        }

        const todayKey = localDateString(new Date(), user?.timezone);
        const today = days.find((day) => day.date === todayKey);
        if (today?.workout) setPlannedWorkout(today.workout);
      } catch (error) {
        console.warn('[workout] week plan load failed', error);
        setPlanError(true);
        if (!silent) setWeekDays([]);
      } finally {
        if (generation === loadGenerationRef.current) {
          setLoadingPlan(false);
          setRefreshingPlan(false);
        }
      }
    },
    [user?.id, user?.timezone, setPlannedWorkout, weekDays.length],
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
        if (today?.workout) setPlannedWorkout(today.workout);
      }

      void warmWeekPlanData(user.id, user?.timezone);
      void loadWeekPlan({ silent: hydratedFromCacheRef.current });
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.timezone, loadWeekPlan, setPlannedWorkout]);

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
    () =>
      weekDays
        .map((day) => day.scheduledWorkout ?? day.workout)
        .filter((workout): workout is PlannedWorkout => workout != null),
    [weekDays],
  );

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
        setPlannedWorkout(day.workout);
        // Without params the cardio screen always defaults to Tabata, so the planned conditioning
        // session the user just tapped is silently discarded.
        router.push({
          pathname: '/(features)/cardio-tracking',
          params: {
            title: day.workout.name,
            activity: conditioningActivityId(day.workout),
          },
        });
        return;
      }
      if (day.workout) {
        setPlannedWorkout(day.workout);
        router.push({ pathname: '/(tabs)/workout/day', params: { id: day.workout.id } });
        return;
      }
      if (day.hasScheduledWorkout) {
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
    // Ending a session is two sequential round trips, so a second tap would end it twice.
    if (finishingRef.current) return;
    finishingRef.current = true;
    setFinishing(true);
    try {
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
    } finally {
      finishingRef.current = false;
      setFinishing(false);
    }
  }, [challengeRecords, endSession, user]);

  const handleChallengeRecord = useCallback((record: WorkoutChallengeRecord) => {
    setChallengeRecords((current) => [...current, record]);
  }, []);

  if (loading && !session && weekDays.length === 0) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={LiftFlowColors.accent} />
      </View>
    );
  }

  if (session) {
    const sessionTabata =
      tabataModeEnabled && plannedWorkout != null && !isConditioningWorkout(plannedWorkout);

    const draftMatchesMode =
      exercises.length > 0 &&
      (sessionTabata ? exercises[0]?.executionMode === 'tabata' : exercises[0]?.executionMode !== 'tabata');

    const draftExercises = draftMatchesMode
      ? exercises
      : exercisesForSessionStart(plannedWorkout, sessionTabata);

    const basePlan =
      draftExercises.length > 0
        ? draftExercises
        : [...session.exercises]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((exercise) => ({
              id: exercise.id,
              name: exercise.exercise?.name ?? 'Exercise',
              // Tabata rounds are not strength sets, so the set count stays mode-independent.
              sets: 3,
              repRange: exercise.suggestedReps ?? '8-10',
              restSeconds: sessionTabata ? INTERVAL_MODE_DEFAULTS.tabata.restSeconds : 90,
              intervalRounds: sessionTabata ? INTERVAL_MODE_DEFAULTS.tabata.rounds : undefined,
              intervalWorkSeconds: sessionTabata ? INTERVAL_MODE_DEFAULTS.tabata.workSeconds : undefined,
              executionMode: sessionTabata ? ('tabata' as const) : undefined,
            }));

    const executionMode = inferExecutionModeFromPlan(
      basePlan,
      normalizeExecutionMode(
        draftExercises[0]?.executionMode ??
          plannedWorkout?.metadata?.executionMode ??
          (sessionTabata ? 'tabata' : undefined),
      ),
    );

    const planForSession = enrichWithSupersetGroups(basePlan, executionMode);

    return (
      <ActiveWorkoutScreen
        session={session}
        planExercises={planForSession}
        executionMode={executionMode}
        challengeRecords={challengeRecords}
        onChallengeRecord={handleChallengeRecord}
        onFinish={handleFinishWorkout}
        onCancel={cancelSession}
        finishing={finishing}
      />
    );
  }

  if (planError && weekDays.every((day) => day.workout == null)) {
    return (
      <ScreenContainer contentContainerStyle={styles.content}>
        <ErrorStateCard
          title="Couldn't load your week"
          message="We couldn't reach your training plan. Check your connection and try again."
          onRetry={() => void loadWeekPlan()}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer contentContainerStyle={styles.content}>
      <WorkoutWeeklyPlanScreen
        days={weekDays}
        loading={loadingPlan}
        refreshing={refreshingPlan}
        adaptingPlan={adaptingPlan}
        timeZone={user?.timezone}
        onSelectDay={handleSelectDay}
        onEditDay={handleEditDay}
        onManualLog={() => router.push('/(tabs)/workout/manual-log')}
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
