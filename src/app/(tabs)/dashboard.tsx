import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, InteractionManager, RefreshControl, StyleSheet, type AlertButton } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { HomeNextUpCard } from '@/components/dashboard/HomeNextUpCard';
import { HomePlanAdjustedBanner } from '@/components/dashboard/HomePlanAdjustedBanner';
import { ManageDayModal } from '@/components/dashboard/ManageDayModal';
import { RecoveryCheckInCue } from '@/components/dashboard/RecoveryCheckInCue';
import { RecoveryModeNotice } from '@/components/dashboard/RecoveryModeNotice';
import { RingGauge } from '@/components/dashboard/RingGauge';
import { WeeklyReviewCard } from '@/components/dashboard/WeeklyReviewCard';
import { InsightCard } from '@/components/insights/InsightCard';
import { Card } from '@/components/layout/Card';
import { HeroPhotoBanner } from '@/components/layout/HeroPhotoBanner';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { SkeletonBlock } from '@/components/layout/SkeletonBlock';
import { StatCard } from '@/components/layout/StatCard';
import { AppText } from '@/components/ui/AppText';
import { HOME_ACTIVITY_OPTIONS } from '@/constants/activityOptions';
import { HeroImages } from '@/constants/imagery';
import { Spacing } from '@/constants/theme';
import { usePlanAdjustment } from '@/contexts/PlanAdjustmentContext';
import { useAppResume } from '@/hooks/useAppResume';
import { useAuth } from '@/hooks/useAuth';
import { useInsightRotator } from '@/hooks/useInsightRotator';
import { useLiftFlowTheme } from '@/hooks/useLiftFlowTheme';
import { useLocalCalendarDay } from '@/hooks/useLocalCalendarDay';
import { useLocalWeekRollover } from '@/hooks/useLocalWeekRollover';
import { useSubscription } from '@/hooks/useSubscription';
import { useTabataModePreference } from '@/hooks/useTabataModePreference';
import { useUnits } from '@/hooks/useUnits';
import { closingWeekStart, useWeeklyReviewWindow } from '@/hooks/useWeeklyReviewPrompt';
import { useWorkoutLocations } from '@/hooks/useWorkoutLocations';
import {
    resolveActiveTrainingDay,
    resolveCoachTrainingGuidance,
    validateWorkoutAssignmentConsistency,
} from '@/lib/activeTrainingDay';
import { formatHomeCoachMessage, formatWhyTodayRationale } from '@/lib/homeCoachMessage';
import { deviceTimeZone, formatScheduledDbTime } from '@/lib/localDate';
import {
    aggregateDailyMeals,
    findNextMeal,
    mealsForCalendarDay,
} from '@/lib/mealAggregation';
import { formatWorkoutTime, scheduleFromProfile, scheduledTimesForDay } from '@/lib/mealSchedule';
import { planDataCache } from '@/lib/planDataCache';
import { warmWeekPlanData } from '@/lib/planDataPrefetch';
import { buildHomeManageDayMenu } from '@/lib/planDayActions';
import { recoveryScoreColor } from '@/lib/recoveryScoreColor';
import { startPlannedWorkout } from '@/lib/startPlannedWorkout';
import { logStartup, printStartupReport } from '@/lib/startupLogger';
import { buildWeekPlan, dedupePlannedWorkoutsByDate, getWeekRange } from '@/lib/weekPlan';
import { withTimeout } from '@/lib/withTimeout';
import { estimateWorkoutDurationMinutes, exercisesFromPlannedWorkout } from '@/lib/workoutPlan';
import { analyticsService } from '@/services/analyticsService';
import { nutritionService } from '@/services/nutritionService';
import { recoveryService } from '@/services/recoveryService';
import { trainingService } from '@/services/trainingService';
import { userService } from '@/services/userService';
import { weeklyCloseoutService } from '@/services/weeklyCloseoutService';
import { useWorkoutPlanDraft } from '@/state/workout/WorkoutPlanDraftContext';
import { useWorkoutSession } from '@/state/workout/WorkoutSessionContext';
import type { DashboardSummary, Meal, NutritionGoals, PlannedWorkout, ProgramDashboard } from '@/types';
import type { RecoveryIntelligenceReport } from '@/types/recoveryIntelligence';

export default function DashboardScreen() {
  const { user, isProfileReady } = useAuth();
  const { adjustment, revision, setFromAdaptation } = usePlanAdjustment();
  const { isPremium } = useSubscription();
  const units = useUnits();
  const { insight } = useInsightRotator();
  const { startSessionFromPlanned, refreshSession } = useWorkoutSession();
  const { setPlannedWorkout, setExercises } = useWorkoutPlanDraft();
  const { tabataModeEnabled } = useTabataModePreference();
  const colors = useLiftFlowTheme();
  const { locations, selectedId } = useWorkoutLocations(user?.id);
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [recoveryScore, setRecoveryScore] = useState<number | null>(null);
  const [recoveryModeActive, setRecoveryModeActive] = useState(false);
  const [recoveryIntel, setRecoveryIntel] = useState<RecoveryIntelligenceReport | null>(null);
  const [program, setProgram] = useState<ProgramDashboard | null>(null);
  const [weekWorkouts, setWeekWorkouts] = useState<PlannedWorkout[]>([]);
  const [nutritionGoals, setNutritionGoals] = useState<NutritionGoals | null>(null);
  const [todayMeals, setTodayMeals] = useState<Meal[]>([]);
  const [programLoading, setProgramLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startingWorkout, setStartingWorkout] = useState(false);
  const [adaptingPlan, setAdaptingPlan] = useState(false);
  const [acceptingWeeklyPlan, setAcceptingWeeklyPlan] = useState(false);
  const [weeklyCloseoutId, setWeeklyCloseoutId] = useState<string | null>(null);
  const [manageDayOpen, setManageDayOpen] = useState(false);
  const homeRenderedRef = useRef(false);
  const appReadyLoggedRef = useRef(false);
  const loadGenerationRef = useRef(0);
  const hydratedFromCacheRef = useRef(false);
  const skipFocusLoadRef = useRef(true);
  const regenCheckedRef = useRef(false);
  const isPremiumRef = useRef(isPremium);
  isPremiumRef.current = isPremium;

  const today = useLocalCalendarDay(user?.timezone);
  const showWeeklyReview = useWeeklyReviewWindow(user?.timezone);
  const closingWeek = useMemo(() => closingWeekStart(new Date(), user?.timezone), [user?.timezone]);

  useEffect(() => {
    if (!user?.id || user.timezone) return;
    void userService.updateProfile(user.id, { timezone: deviceTimeZone() });
  }, [user?.id, user?.timezone]);

  useEffect(() => {
    if (homeRenderedRef.current) return;
    homeRenderedRef.current = true;
    logStartup('HOME_RENDERED');
  }, []);

  useEffect(() => {
    if (isProfileReady && user && !user.onboardingCompleted) {
      router.replace('/(onboarding)/legal');
    }
  }, [isProfileReady, user]);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!user) {
      setProgramLoading(false);
      setSummaryLoading(false);
      return;
    }

    const generation = ++loadGenerationRef.current;
    const silent = options?.silent ?? hydratedFromCacheRef.current;

    if (!silent) {
      setProgramLoading(true);
    }

    const { from, to } = getWeekRange(new Date(), user?.timezone);

    const applyWeekCache = (cached: Awaited<ReturnType<typeof planDataCache.readWeek>>) => {
      if (cached.workouts.length > 0) {
        const workouts = dedupePlannedWorkoutsByDate(cached.workouts, new Date(), user.timezone);
        setWeekWorkouts(workouts);
        hydratedFromCacheRef.current = true;
        setProgramLoading(false);
      }
      if (cached.goals) {
        setNutritionGoals(cached.goals);
        hydratedFromCacheRef.current = true;
      }
      if (cached.meals.length > 0) {
        setTodayMeals(mealsForCalendarDay(cached.meals, today));
        hydratedFromCacheRef.current = true;
        setSummaryLoading(false);
      }
      if (cached.program) setProgram(cached.program);
    };

    try {
      const cached = await planDataCache.readWeek(user.id, from, to);
      if (generation !== loadGenerationRef.current) return;
      applyWeekCache(cached);
    } catch (error) {
      console.warn('[dashboard] workout plan load failed', error);
    } finally {
      if (generation === loadGenerationRef.current) {
        setProgramLoading(false);
        setSummaryLoading(false);
        setRefreshing(false);
      }
    }

    void withTimeout(
      warmWeekPlanData(user.id, user.timezone),
      hydratedFromCacheRef.current ? 8_000 : 10_000,
      'week plan warm',
    )
      .catch(() => undefined)
      .then(async () => {
        if (generation !== loadGenerationRef.current) return;
        try {
          const fresh = await planDataCache.readWeek(user.id, from, to);
          if (generation !== loadGenerationRef.current) return;
          applyWeekCache(fresh);
          logStartup('WORKOUT_PLAN_LOADED', { count: fresh.workouts.length });
          logStartup('WORKOUTS_LOADED');
          if (fresh.meals.length > 0) {
            logStartup('NUTRITION_PLAN_LOADED', { count: fresh.meals.length });
          }
        } catch (error) {
          console.warn('[dashboard] week plan refresh failed', error);
        }
      });

    InteractionManager.runAfterInteractions(() => {
      void (async () => {
        try {
          const [programResult, dashResult] = await Promise.all([
            trainingService.getDashboard(user.id),
            analyticsService.getDashboard(user.id),
          ]);
          if (generation !== loadGenerationRef.current) return;
          if (programResult.success) {
            setProgram(programResult.data);
            void planDataCache.writeProgram(user.id, from, to, programResult.data);
          }
          if (dashResult.success) setData(dashResult.data);
        } catch (error) {
          console.warn('[dashboard] deferred dashboard load failed', error);
        }
      })();

      void (async () => {
        try {
          const recoveryResult = isPremiumRef.current
            ? await recoveryService.getIntelligence(user.id)
            : await recoveryService.getToday(user.id);

          if (generation !== loadGenerationRef.current) return;

          if (isPremiumRef.current) {
            const intelResult = recoveryResult as Awaited<ReturnType<typeof recoveryService.getIntelligence>>;
            if (intelResult.success) {
              setRecoveryIntel(intelResult.data);
              setRecoveryScore(intelResult.data.recoveryScore);
              setRecoveryModeActive(intelResult.data.recoveryScore < 40);
            } else {
              setRecoveryIntel(null);
              setRecoveryScore(null);
              setRecoveryModeActive(false);
            }
          } else {
            const todayResult = recoveryResult as Awaited<ReturnType<typeof recoveryService.getToday>>;
            setRecoveryIntel(null);
            if (todayResult.success && todayResult.data) {
              setRecoveryScore(todayResult.data.recoveryScore);
              setRecoveryModeActive(todayResult.data.recoveryModeActive);
            } else {
              setRecoveryScore(null);
              setRecoveryModeActive(false);
            }
          }
          logStartup('RECOVERY_LOADED');
        } catch (error) {
          console.warn('[dashboard] recovery load failed', error);
        }
      })();

      void nutritionService.pruneDuplicateMeals(user.id).catch(() => undefined);
    });

    if (!appReadyLoggedRef.current && generation === loadGenerationRef.current) {
      appReadyLoggedRef.current = true;
      logStartup('APP_READY');
      printStartupReport();
    }
  }, [user?.id, user?.timezone, today]);

  useEffect(() => {
    if (!user?.id || regenCheckedRef.current) return;
    regenCheckedRef.current = true;

    const task = InteractionManager.runAfterInteractions(() => {
      void trainingService.regenerateProgramIfNeeded(user.id).then((regen) => {
        if (regen.success && regen.data.regenerated) void load({ silent: true });
      });
    });

    return () => task.cancel();
  }, [user?.id, load]);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    const { from, to } = getWeekRange(new Date(), user.timezone);

    void (async () => {
      const cached = await planDataCache.readWeek(user.id, from, to);
      if (cancelled) return;

      if (cached.workouts.length > 0) {
        setWeekWorkouts(cached.workouts);
        setProgramLoading(false);
        hydratedFromCacheRef.current = true;
      }
      if (cached.program) setProgram(cached.program);
      if (cached.goals) setNutritionGoals(cached.goals);
      if (cached.meals.length > 0) {
        setTodayMeals(mealsForCalendarDay(cached.meals, today));
        setSummaryLoading(false);
        hydratedFromCacheRef.current = true;
      }

      const hasCache =
        cached.workouts.length > 0 || cached.meals.length > 0 || cached.program != null;
      if (hasCache) {
        InteractionManager.runAfterInteractions(() => {
          void load({ silent: true });
        });
      } else {
        void warmWeekPlanData(user.id, user.timezone);
        void load({ silent: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.timezone, load, today]);

  useFocusEffect(
    useCallback(() => {
      if (skipFocusLoadRef.current) {
        skipFocusLoadRef.current = false;
        return;
      }
      if (user) void load({ silent: true });
    }, [user, load]),
  );

  useAppResume(() => {
    if (user) void load({ silent: true });
  });

  useLocalWeekRollover(user?.timezone, () => {
    if (user) {
      void load();
      void trainingService.regenerateProgramIfNeeded(user.id).then((regen) => {
        if (regen.success && regen.data.regenerated) void load();
      });
    }
  });

  useEffect(() => {
    if (!adjustment || !user) return;
    const { from, to } = getWeekRange(new Date(), user.timezone);
    void nutritionService.getMealsForWeek(user.id, from, to).then((mealsResult) => {
      if (!mealsResult.success) return;
      void planDataCache.writeMeals(user.id, from, to, mealsResult.data);
      setTodayMeals(mealsForCalendarDay(mealsResult.data, today));
    });
  }, [adjustment?.id, revision, user, today]);

  useEffect(() => {
    if (revision > 0 && user) void load({ silent: true });
  }, [revision, user, load]);

  useEffect(() => {
    if (!user || !showWeeklyReview) return;
    void weeklyCloseoutService.prepare(user.id).then((result) => {
      if (result.success) setWeeklyCloseoutId(result.data.id);
    });
  }, [user, showWeeklyReview]);

  function handleLogActivity() {
    const buttons: AlertButton[] = HOME_ACTIVITY_OPTIONS.map((option) => ({
      text: option.label,
      onPress: () => router.push(option.route as never),
    }));
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Log Activity', 'Choose activity type', buttons);
  }

  async function handleAcceptWeeklyPlan() {
    if (!user || !weeklyCloseoutId) {
      router.push('/(features)/next-week-plan');
      return;
    }
    setAcceptingWeeklyPlan(true);
    const result = await weeklyCloseoutService.accept(user.id, weeklyCloseoutId);
    setAcceptingWeeklyPlan(false);
    if (result.success) {
      Alert.alert('Plan accepted', 'Next week is active. Completed week archived.');
    } else {
      Alert.alert('Error', result.error);
    }
  }

  const activeTrainingDay = useMemo(
    () =>
      resolveActiveTrainingDay(weekWorkouts, {
        date: today,
        timeZone: user?.timezone,
      }),
    [weekWorkouts, today, user?.timezone],
  );

  const coachGuidance = useMemo(
    () => resolveCoachTrainingGuidance(recoveryIntel, recoveryScore, activeTrainingDay),
    [recoveryIntel, recoveryScore, activeTrainingDay],
  );

  const todaysWorkout = activeTrainingDay.workout;
  const hasWorkoutToday = todaysWorkout != null;
  const nextPlanned = program?.nextWorkout;
  const showWorkoutSection = !programLoading;
  const scheduleWithWorkout = scheduleFromProfile(user, hasWorkoutToday);
  const hasRecoveryScore = recoveryScore != null;
  const readinessScore = recoveryIntel?.factors?.muscleReadinessScore ?? null;

  const handleRecoveryPress = useCallback(() => {
    if (!hasRecoveryScore) {
      router.push('/(features)/recovery-check-in');
      return;
    }
    if (isPremium) {
      router.push('/(features)/recovery-analysis');
      return;
    }
    router.push('/(features)/recovery-check-in');
  }, [hasRecoveryScore, isPremium]);

  const trainingLabel = coachGuidance.trainingLabel;

  useEffect(() => {
    if (!__DEV__ || !user?.id) return;
    const weekPlan = buildWeekPlan(weekWorkouts, new Date(), user.timezone);
    const plannerDay = weekPlan.find((day) => day.date === today) ?? null;
    const mismatches = validateWorkoutAssignmentConsistency({
      home: activeTrainingDay,
      planner: plannerDay
        ? resolveActiveTrainingDay(weekWorkouts, { date: plannerDay.date, timeZone: user.timezone })
        : null,
    });
    if (mismatches.length > 0) {
      console.warn('[activeTrainingDay] assignment mismatch', mismatches);
    }
  }, [activeTrainingDay, today, user?.id, user?.timezone, weekWorkouts]);

  const mealAggregation = useMemo(() => aggregateDailyMeals(todayMeals), [todayMeals]);
  const todayTimes = useMemo(
    () =>
      scheduledTimesForDay(
        mealAggregation.dedupedMeals.map((meal) => meal.mealType),
        scheduleWithWorkout,
        hasWorkoutToday,
      ),
    [mealAggregation.dedupedMeals, scheduleWithWorkout, hasWorkoutToday],
  );
  const nextMealEntry = useMemo(
    () => findNextMeal(todayMeals, todayTimes, new Date(), user?.timezone),
    [todayMeals, todayTimes, user?.timezone],
  );

  const calorieTarget = nutritionGoals?.dailyCalories ?? 0;
  const proteinTarget = nutritionGoals?.proteinG ?? 0;
  const caloriesRemaining = Math.max(0, calorieTarget - mealAggregation.caloriesConsumed);
  const proteinRemaining = Math.max(0, proteinTarget - mealAggregation.proteinG);

  const coachHeadline = coachGuidance.coachHeadline;

  const coachMessage = formatHomeCoachMessage(coachGuidance, {
    scheduledWorkout: todaysWorkout,
    recoveryIntel,
    recoveryScore,
  });
  const whyToday = formatWhyTodayRationale(todaysWorkout?.aiRationale);

  const workoutDurationMin = todaysWorkout
    ? estimateWorkoutDurationMinutes(exercisesFromPlannedWorkout(todaysWorkout)) ||
      user?.metadata?.coachProfile?.minutesPerWorkout ||
      60
    : undefined;

  const workoutStartTime =
    formatScheduledDbTime(todaysWorkout?.scheduledTime) ?? formatWorkoutTime(scheduleWithWorkout);

  const manageDayMenu = useMemo(() => {
    if (!user) return null;
    return buildHomeManageDayMenu(
      {
        userId: user.id,
        workouts: weekWorkouts,
        setFromAdaptation,
        onWorkoutsUpdated: setWeekWorkouts,
        onComplete: () => {
          if (!user) return;
          const { from, to } = getWeekRange(new Date(), user.timezone);
          void nutritionService.getMealsForWeek(user.id, from, to).then((mealsResult) => {
            if (!mealsResult.success) return;
            void planDataCache.writeMeals(user.id, from, to, mealsResult.data);
            setTodayMeals(mealsForCalendarDay(mealsResult.data, today));
          });
        },
        onBusyChange: setAdaptingPlan,
        timeZone: user.timezone,
      },
      today,
    );
  }, [user, weekWorkouts, setFromAdaptation, today, load]);

  function handleManageDay() {
    if (!manageDayMenu) {
      Alert.alert('Manage Day', 'No planned workouts this week to adjust.');
      return;
    }
    setManageDayOpen(true);
  }

  async function handleStartNextWorkout(planned: PlannedWorkout) {
    if (!user || startingWorkout) return;
    setStartingWorkout(true);
    try {
      const result = await startPlannedWorkout({
        user,
        planned,
        tabataModeEnabled,
        locations,
        selectedLocationId: selectedId,
        startSessionFromPlanned,
        refreshSession,
      });
      if (!result) return;

      setPlannedWorkout(planned);
      setExercises(result.sessionExercises);
      router.push('/(tabs)/workout');
    } finally {
      setStartingWorkout(false);
    }
  }

  return (
    <ScreenContainer
      testID="home-screen"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          tintColor={colors.primary}
        />
      }>
      <HeroPhotoBanner
        sources={todaysWorkout ? HeroImages.dashboard.heroWorkout : HeroImages.dashboard.heroRest}
        height={todaysWorkout ? 200 : 192}
        showBrand={false}
        eyebrow="Today"
        title={user?.displayName ? `Hey, ${user.displayName.split(' ')[0]}` : 'Your day'}
        subtitle={coachHeadline}
      />

      <HomePlanAdjustedBanner />

      <RecoveryModeNotice recoveryScore={recoveryScore} recoveryModeActive={recoveryModeActive} />

      {!hasRecoveryScore && !summaryLoading ? (
        <RecoveryCheckInCue onPress={handleRecoveryPress} />
      ) : null}

      <Animated.View entering={FadeInDown.delay(120).duration(400)}>
        {programLoading ? (
          <Card style={styles.emptyWorkout} glow>
            <SkeletonBlock height={160} />
          </Card>
        ) : (
          <HomeNextUpCard
            nextMeal={
              nextMealEntry
                ? {
                    name: nextMealEntry.meal.name,
                    mealType: nextMealEntry.meal.mealType,
                    scheduledTime: nextMealEntry.scheduledTime,
                    overdue: nextMealEntry.overdue,
                  }
                : null
            }
            caloriesRemaining={caloriesRemaining}
            proteinRemainingG={proteinRemaining}
            mealsCompleted={mealAggregation.mealsCompleted}
            mealsTotal={mealAggregation.mealsTotal}
            workout={
              todaysWorkout
                ? {
                    title: todaysWorkout.name,
                    durationMin: workoutDurationMin,
                    startTime: workoutStartTime,
                    trainingLabel,
                    recoveryScore: hasRecoveryScore ? recoveryScore : null,
                    coachMessage,
                    whyToday,
                  }
                : null
            }
            onLogMeal={() => router.push('/(tabs)/nutrition')}
            onQuickLogMeal={() => router.push('/(tabs)/nutrition?log=1')}
            onGenerateMealPlan={() => router.push('/(tabs)/nutrition?generate=1')}
            onViewWorkout={() => {
              if (!todaysWorkout) return;
              router.push({ pathname: '/(tabs)/workout/day', params: { id: todaysWorkout.id } });
            }}
            onStartWorkout={() => todaysWorkout && handleStartNextWorkout(todaysWorkout)}
            onManageDay={handleManageDay}
            onLogActivity={handleLogActivity}
            tabataModeEnabled={tabataModeEnabled}
            showWorkoutSection={showWorkoutSection}
            isRestDay={!todaysWorkout}
            showWorkoutBanner={!todaysWorkout}
            startingWorkout={startingWorkout}
            adaptingPlan={adaptingPlan}
          />
        )}
      </Animated.View>

      {showWeeklyReview ? (
        <Animated.View entering={FadeInDown.delay(120).duration(400)}>
          <WeeklyReviewCard
            weekLabel={`Week of ${closingWeek}`}
            onViewSummary={() => router.push('/(features)/weekly-summary')}
            onReviewNextWeek={() => router.push('/(features)/next-week-plan')}
            onAdjust={() => router.push('/(tabs)/workout')}
            onAccept={handleAcceptWeeklyPlan}
            accepting={acceptingWeeklyPlan}
          />
        </Animated.View>
      ) : null}

      {!nextPlanned && !programLoading && user?.onboardingCompleted ? (
        <Animated.View entering={FadeInDown.delay(150).duration(400)}>
          <Card glow style={styles.emptyWorkout}>
            <AppText variant="bodyBold">Your coach is syncing</AppText>
            <AppText variant="footnote" color="textSecondary">
              Pull to refresh — your program should appear momentarily.
            </AppText>
            <PrimaryButton label="Refresh Plan" onPress={() => { setRefreshing(true); load(); }} />
          </Card>
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInDown.delay(180).duration(400)} style={styles.statsRow}>
        {summaryLoading && recoveryScore === null ? (
          <StatCard label="Recovery">
            <SkeletonBlock height={72} />
          </StatCard>
        ) : (
          <StatCard
            label="Recovery"
            density="compact"
            footer={trainingLabel}
            footerColor="accent"
            onPress={handleRecoveryPress}>
            <RingGauge
              label=""
              value={recoveryScore}
              color={recoveryScoreColor(recoveryScore)}
              size={64}
            />
            <AppText variant="caption" color="textTertiary" align="center">
              Tap for details
            </AppText>
          </StatCard>
        )}
        {summaryLoading && !data ? (
          <StatCard label="Progress">
            <SkeletonBlock height={72} />
          </StatCard>
        ) : (
          <StatCard
            label="Progress"
            density="compact"
            footer={`${data?.weeklyWorkouts ?? 0} wk · ${data?.streak ?? 0}d streak`}>
            <AppText variant="bodyBold" style={styles.weightMetric}>
              {units.formatWeight(data?.currentWeightKg)}
            </AppText>
          </StatCard>
        )}
      </Animated.View>

      {insight ? (
        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <SectionHeader title="Today's Insight" variant="secondary" />
          <InsightCard insight={insight} />
        </Animated.View>
      ) : null}

      {manageDayMenu ? (
        <ManageDayModal
          visible={manageDayOpen}
          title={manageDayMenu.title}
          showWeekList={manageDayMenu.showWeekList}
          weeklyPlan={manageDayMenu.weeklyPlan}
          focusDate={manageDayMenu.focusDate}
          todayLabel={manageDayMenu.todayLabel}
          focusWorkoutId={manageDayMenu.focusWorkoutId}
          actions={manageDayMenu.actions}
          swapTargets={manageDayMenu.swapTargets}
          moveTargets={manageDayMenu.moveTargets}
          restDayTargets={manageDayMenu.restDayTargets}
          doTodayTargets={manageDayMenu.doTodayTargets}
          onScheduleChange={manageDayMenu.onScheduleChange}
          onClose={() => setManageDayOpen(false)}
        />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  emptyWorkout: {
    gap: Spacing.md,
  },
  weightMetric: {
    fontSize: 22,
    lineHeight: 28,
  },
});
