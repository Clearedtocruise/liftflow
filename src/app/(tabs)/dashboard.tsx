import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';

import { HomeNextUpCard } from '@/components/dashboard/HomeNextUpCard';
import { HomePlanAdjustedBanner } from '@/components/dashboard/HomePlanAdjustedBanner';
import { RingGauge } from '@/components/dashboard/RingGauge';
import { InsightCard } from '@/components/insights/InsightCard';
import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { Brand, LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { pickDefaultLocation } from '@/constants/trainingProfile';
import { useAuth } from '@/hooks/useAuth';
import { usePlanAdjustment } from '@/contexts/PlanAdjustmentContext';
import { useInsightRotator } from '@/hooks/useInsightRotator';
import { useSubscription } from '@/hooks/useSubscription';
import { useUnits } from '@/hooks/useUnits';
import { useWorkoutLocations } from '@/hooks/useWorkoutLocations';
import {
    aggregateDailyMeals,
    findNextMeal,
    trainingLabelFromRecoveryScore,
} from '@/lib/mealAggregation';
import { deviceTimeZone, formatScheduledDbTime, localDateString } from '@/lib/localDate';
import { formatWorkoutTime, scheduleFromProfile, scheduledTimesForDay } from '@/lib/mealSchedule';
import { logStartup } from '@/lib/startupLogger';
import { getWeekRange } from '@/lib/weekPlan';
import { estimateWorkoutDurationMinutes, exercisesFromPlannedWorkout } from '@/lib/workoutPlan';
import { analyticsService } from '@/services/analyticsService';
import { nutritionService } from '@/services/nutritionService';
import { recoveryService } from '@/services/recoveryService';
import { trainingService } from '@/services/trainingService';
import { userService } from '@/services/userService';
import { useWorkoutSession } from '@/state/workout/WorkoutSessionContext';
import type { DashboardSummary, Meal, NutritionGoals, PlannedWorkout, ProgramDashboard } from '@/types';
import type { RecoveryIntelligenceReport } from '@/types/recoveryIntelligence';

export default function DashboardScreen() {
  const { user, isProfileReady } = useAuth();
  const { adjustment, revision } = usePlanAdjustment();
  const { isPremium } = useSubscription();
  const units = useUnits();
  const { insight } = useInsightRotator();
  const { startSessionFromPlanned } = useWorkoutSession();
  const { locations, selectedId } = useWorkoutLocations(user?.id);
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [recoveryScore, setRecoveryScore] = useState<number | null>(null);
  const [recoveryIntel, setRecoveryIntel] = useState<RecoveryIntelligenceReport | null>(null);
  const [program, setProgram] = useState<ProgramDashboard | null>(null);
  const [nutritionGoals, setNutritionGoals] = useState<NutritionGoals | null>(null);
  const [todayMeals, setTodayMeals] = useState<Meal[]>([]);
  const [programLoading, setProgramLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startingWorkout, setStartingWorkout] = useState(false);
  const homeRenderedRef = useRef(false);
  const appReadyLoggedRef = useRef(false);

  const today = useMemo(() => localDateString(new Date(), user?.timezone), [user?.timezone]);

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

  const load = useCallback(async () => {
    if (!user) return;

    setProgramLoading(true);
    setSummaryLoading(true);

    const { from, to } = getWeekRange();

    await nutritionService.pruneDuplicateMeals(user.id);

    void trainingService.getDashboard(user.id).then((programResult) => {
      if (programResult.success) setProgram(programResult.data);
      setProgramLoading(false);
      logStartup('WORKOUTS_LOADED');
    });

    void Promise.all([
      analyticsService.getDashboard(user.id),
      nutritionService.getGoals(user.id),
      nutritionService.getMealsForWeek(user.id, from, to),
      isPremium ? recoveryService.getIntelligence(user.id) : recoveryService.getToday(user.id),
    ]).then(([dashResult, goalsResult, mealsResult, recoveryResult]) => {
      if (dashResult.success) setData(dashResult.data);
      if (goalsResult.success) setNutritionGoals(goalsResult.data);
      if (mealsResult.success) {
        setTodayMeals(mealsResult.data.filter((meal) => meal.scheduledDate === today));
      }

      if (isPremium) {
        const intelResult = recoveryResult as Awaited<ReturnType<typeof recoveryService.getIntelligence>>;
        if (intelResult.success) {
          setRecoveryIntel(intelResult.data);
          setRecoveryScore(intelResult.data.recoveryScore);
        } else {
          setRecoveryIntel(null);
          setRecoveryScore(null);
        }
      } else {
        const todayResult = recoveryResult as Awaited<ReturnType<typeof recoveryService.getToday>>;
        setRecoveryIntel(null);
        if (todayResult.success && todayResult.data) {
          setRecoveryScore(todayResult.data.recoveryScore);
        } else {
          setRecoveryScore(null);
        }
      }

      setSummaryLoading(false);
      setRefreshing(false);

      if (!appReadyLoggedRef.current) {
        appReadyLoggedRef.current = true;
        logStartup('APP_READY');
      }
    });
  }, [user, isPremium, today]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (user) load();
    }, [user, load]),
  );

  useEffect(() => {
    if (adjustment && user) load();
  }, [adjustment?.id, revision, user, load]);

  const nextPlanned = program?.nextWorkout;
  const hasWorkoutToday = nextPlanned?.scheduledDate === today;
  const todaysWorkout = hasWorkoutToday ? nextPlanned : null;
  const scheduleWithWorkout = scheduleFromProfile(user, hasWorkoutToday);
  const hasRecoveryScore = recoveryScore != null;

  const trainingLabel =
    recoveryIntel?.trainingRecommendationLabel ??
    (hasRecoveryScore ? trainingLabelFromRecoveryScore(recoveryScore) : 'Check in');

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

  const coachHeadline = recoveryIntel?.trainingRecommendationLabel
    ? `${trainingLabel} recommended today`
    : hasRecoveryScore
      ? recoveryScore! >= 75
        ? 'You are cleared to train.'
        : recoveryScore! >= 55
          ? 'Keep training lighter today.'
          : 'Prioritize recovery before intensity.'
      : 'Log a recovery check-in to personalize coaching.';

  const coachMessage =
    recoveryIntel?.rationale ??
    user?.metadata?.coachActivation?.coachMessage ??
    (hasRecoveryScore
      ? recoveryScore! >= 80
        ? 'Recovery is high. Increase training volume slightly if warm-ups feel strong.'
        : 'Prioritize quality over volume. Match nutrition to your remaining macros.'
      : 'Complete today\'s recovery check-in for an accurate score and training guidance.');

  const workoutDurationMin = todaysWorkout
    ? estimateWorkoutDurationMinutes(exercisesFromPlannedWorkout(todaysWorkout)) ||
      user?.metadata?.coachProfile?.minutesPerWorkout ||
      60
    : undefined;

  const workoutStartTime =
    formatScheduledDbTime(todaysWorkout?.scheduledTime) ?? formatWorkoutTime(scheduleWithWorkout);

  async function handleStartNextWorkout(planned: PlannedWorkout) {
    if (!user) return;
    const location = pickDefaultLocation(locations, selectedId);
    setStartingWorkout(true);
    const started = await startSessionFromPlanned(planned.id, {
      name: planned.name,
      gymName: location?.name ?? user.primaryGymName ?? undefined,
      trainingLocation: location?.locationType ?? user.trainingLocation,
      workoutLocationId: location?.id,
    });
    setStartingWorkout(false);
    if (started) router.push('/(tabs)/workout');
  }

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          tintColor={LiftFlowColors.primary}
        />
      }>
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <AppText variant="headline" style={styles.heroHeadline}>
          {user?.displayName ? `Hey, ${user.displayName.split(' ')[0]}` : Brand.heroHeadline}
        </AppText>
        <AppText variant="footnote" color="textSecondary" align="center">
          {coachHeadline}
        </AppText>
      </Animated.View>

      <HomePlanAdjustedBanner />

      <Animated.View entering={FadeInDown.delay(60).duration(400)}>
        {summaryLoading && !coachMessage ? (
          <View style={styles.aiOuter}>
            <LinearGradient colors={['rgba(31, 107, 255, 0.35)', 'rgba(0, 229, 255, 0.12)']} style={styles.aiBorder}>
              <View style={styles.aiCard}>
                <SkeletonBlock height={14} width="30%" />
                <SkeletonBlock height={20} width="70%" />
                <SkeletonBlock height={14} width="90%" />
              </View>
            </LinearGradient>
          </View>
        ) : (
          <View style={styles.aiOuter}>
            <LinearGradient colors={['rgba(31, 107, 255, 0.35)', 'rgba(0, 229, 255, 0.12)']} style={styles.aiBorder}>
              <View style={styles.aiCard}>
                <AppText variant="label" color="primary">
                  AI Coach
                </AppText>
                <AppText variant="footnote" color="textSecondary">
                  {coachMessage}
                </AppText>
              </View>
            </LinearGradient>
          </View>
        )}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(120).duration(400)}>
        {programLoading || summaryLoading ? (
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
                  }
                : null
            }
            onLogMeal={() => router.push('/(tabs)/nutrition')}
            onStartWorkout={() => todaysWorkout && handleStartNextWorkout(todaysWorkout)}
            startingWorkout={startingWorkout}
          />
        )}
      </Animated.View>

      {!nextPlanned && !programLoading && user?.onboardingCompleted ? (
        <Animated.View entering={FadeInDown.delay(150).duration(400)}>
          <Card style={styles.emptyWorkout} glow>
            <AppText variant="bodyBold">Your coach is syncing</AppText>
            <AppText variant="footnote" color="textSecondary">
              Pull to refresh — your program should appear momentarily.
            </AppText>
            <PrimaryButton label="Refresh Plan" onPress={() => { setRefreshing(true); load(); }} />
          </Card>
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInDown.delay(180).duration(400)}>
        {summaryLoading && recoveryScore === null ? (
          <Card style={styles.recoveryCard} glow>
            <SkeletonBlock height={14} width="45%" />
            <View style={styles.gaugeRow}>
              <SkeletonBlock height={88} width={88} style={styles.skeletonCircle} />
            </View>
          </Card>
        ) : (
          <Card style={styles.recoveryCard} glow>
            <AppText variant="label" color="accent">
              Recovery
            </AppText>
            <View style={styles.gaugeRow}>
              <RingGauge label="Score" value={recoveryScore} color={LiftFlowColors.success} />
              <View style={styles.trainingBadge}>
                <AppText variant="caption" color="textTertiary">
                  Today
                </AppText>
                <AppText variant="headline" color="accent">
                  {trainingLabel}
                </AppText>
                {recoveryIntel?.recoveryStatusLabel ? (
                  <AppText variant="footnote" color="textSecondary" align="center">
                    {recoveryIntel.recoveryStatusLabel}
                  </AppText>
                ) : !hasRecoveryScore ? (
                  <AppText variant="footnote" color="textSecondary" align="center">
                    Check in for your score
                  </AppText>
                ) : null}
                {recoveryIntel?.transparency?.estimatedFromDefaults ? (
                  <AppText variant="caption" color="textTertiary" align="center">
                    Partial check-in — some inputs estimated
                  </AppText>
                ) : null}
              </View>
            </View>
          </Card>
        )}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(240).duration(400)}>
        {summaryLoading && !data ? (
          <Card style={styles.progressCard}>
            <SkeletonBlock height={14} width="30%" />
            <SkeletonBlock height={36} width="45%" />
            <SkeletonBlock height={14} width="65%" />
          </Card>
        ) : (
          <Card style={styles.progressCard}>
            <AppText variant="label" color="accent">
              Progress
            </AppText>
            <AppText variant="metric" style={styles.weightMetric}>
              {units.formatWeight(data?.currentWeightKg)}
            </AppText>
            <AppText variant="footnote" color="textSecondary">
              Current weight · {data?.weeklyWorkouts ?? 0} workouts this week · {data?.streak ?? 0}d streak
            </AppText>
          </Card>
        )}
      </Animated.View>

      {insight ? (
        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <AppText variant="subhead" color="textSecondary" style={styles.insightLabel}>
            Today&apos;s Insight
          </AppText>
          <InsightCard insight={insight} />
        </Animated.View>
      ) : null}
    </ScreenContainer>
  );
}

function SkeletonBlock({
  height,
  width = '100%',
  style,
}: {
  height: number;
  width?: number | `${number}%`;
  style?: ViewStyle;
}) {
  return <View style={[styles.skeleton, { height, width }, style]} />;
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.sm,
    marginBottom: Spacing.xxl,
    alignItems: 'center',
  },
  heroHeadline: {
    textAlign: 'center',
    letterSpacing: 0.8,
    lineHeight: 30,
  },
  recoveryCard: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  gaugeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  trainingBadge: {
    alignItems: 'center',
    gap: Spacing.xs,
    maxWidth: 140,
  },
  aiOuter: {
    marginBottom: Spacing.lg,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  aiBorder: {
    borderRadius: Radius.lg,
    padding: 1,
  },
  aiCard: {
    backgroundColor: LiftFlowColors.surface,
    borderRadius: Radius.lg - 1,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  emptyWorkout: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  progressCard: {
    gap: Spacing.sm,
    marginBottom: Spacing.xxl,
  },
  weightMetric: {
    fontSize: 32,
    lineHeight: 38,
  },
  insightLabel: {
    marginBottom: Spacing.md,
  },
  skeleton: {
    backgroundColor: LiftFlowColors.backgroundSecondary,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  skeletonCircle: {
    borderRadius: 44,
  },
});
