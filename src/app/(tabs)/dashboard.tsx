import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { RingGauge } from '@/components/dashboard/RingGauge';
import { WorkoutHeroCard } from '@/components/dashboard/WorkoutHeroCard';
import { InsightCard } from '@/components/insights/InsightCard';
import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { Brand, LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { pickDefaultLocation } from '@/constants/trainingProfile';
import { useAuth } from '@/hooks/useAuth';
import { useInsightRotator } from '@/hooks/useInsightRotator';
import { useSubscription } from '@/hooks/useSubscription';
import { useUnits } from '@/hooks/useUnits';
import { useWorkoutLocations } from '@/hooks/useWorkoutLocations';
import { logStartup } from '@/lib/startupLogger';
import { analyticsService } from '@/services/analyticsService';
import { nutritionService } from '@/services/nutritionService';
import { recoveryService } from '@/services/recoveryService';
import { trainingService } from '@/services/trainingService';
import { useWorkoutSession } from '@/state/workout/WorkoutSessionContext';
import type { DashboardSummary, NutritionGoals, PlannedWorkout, ProgramDashboard } from '@/types';

export default function DashboardScreen() {
  const { user, isProfileReady } = useAuth();
  const { isPremium } = useSubscription();
  const units = useUnits();
  const { insight } = useInsightRotator();
  const { startSessionFromPlanned } = useWorkoutSession();
  const { locations, selectedId } = useWorkoutLocations(user?.id);
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [recoveryScore, setRecoveryScore] = useState<number | null>(null);
  const [recoveryStatusLabel, setRecoveryStatusLabel] = useState<string | null>(null);
  const [program, setProgram] = useState<ProgramDashboard | null>(null);
  const [nutritionGoals, setNutritionGoals] = useState<NutritionGoals | null>(null);
  const [programLoading, setProgramLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startingWorkout, setStartingWorkout] = useState(false);
  const homeRenderedRef = useRef(false);
  const appReadyLoggedRef = useRef(false);

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

    void trainingService.getDashboard(user.id).then((programResult) => {
      if (programResult.success) setProgram(programResult.data);
      setProgramLoading(false);
      logStartup('WORKOUTS_LOADED');
    });

    void Promise.all([
      analyticsService.getDashboard(user.id),
      nutritionService.getGoals(user.id),
      isPremium ? recoveryService.getIntelligence(user.id) : recoveryService.getToday(user.id),
    ]).then(([dashResult, goalsResult, recoveryResult]) => {
      if (dashResult.success) setData(dashResult.data);
      if (goalsResult.success) setNutritionGoals(goalsResult.data);

      if (isPremium) {
        const intelResult = recoveryResult as Awaited<ReturnType<typeof recoveryService.getIntelligence>>;
        if (intelResult.success) {
          setRecoveryScore(intelResult.data.recoveryScore);
          setRecoveryStatusLabel(intelResult.data.recoveryStatusLabel);
        }
      } else {
        const todayResult = recoveryResult as Awaited<ReturnType<typeof recoveryService.getToday>>;
        if (todayResult.success && todayResult.data) {
          setRecoveryScore(todayResult.data.recoveryScore);
          setRecoveryStatusLabel(null);
        } else {
          setRecoveryScore(null);
          setRecoveryStatusLabel(null);
        }
      }

      setSummaryLoading(false);
      setRefreshing(false);

      if (!appReadyLoggedRef.current) {
        appReadyLoggedRef.current = true;
        logStartup('APP_READY');
      }
    });
  }, [user, isPremium]);

  useEffect(() => {
    load();
  }, [load]);

  const nextPlanned = program?.nextWorkout;
  const displayRecoveryScore =
    recoveryScore ??
    (data?.recoveryStatus === 'optimal' ? 88 : data?.recoveryStatus === 'moderate' ? 72 : 65);
  const readinessScore = Math.min(95, displayRecoveryScore - 4 + (data?.streak ?? 0));
  const coachMessage =
    user?.metadata?.coachActivation?.coachMessage ??
    (displayRecoveryScore >= 80
      ? 'Recovery is high today. Increase training volume by 5% if warm-ups feel strong.'
      : 'Prioritize quality over volume today. Keep intensity moderate.');
  const coachHeadline =
    recoveryStatusLabel ??
    (displayRecoveryScore >= 80 ? 'Recovery is high today.' : 'Prioritize quality over volume today.');
  const proteinTarget = nutritionGoals?.proteinG ?? 0;
  const calorieTarget = nutritionGoals?.dailyCalories ?? 0;

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
          {Brand.heroHeadline}
        </AppText>
        <AppText variant="footnote" color="accent" align="center">
          {Brand.taglinePrimary}
        </AppText>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(60).duration(400)}>
        {summaryLoading && recoveryScore === null ? (
          <Card style={styles.recoveryCard} glow>
            <SkeletonBlock height={14} width="45%" />
            <View style={styles.gaugeRow}>
              <SkeletonBlock height={88} width={88} style={styles.skeletonCircle} />
              <SkeletonBlock height={88} width={88} style={styles.skeletonCircle} />
            </View>
          </Card>
        ) : (
          <Card style={styles.recoveryCard} glow>
            <AppText variant="label" color="accent">
              Recovery & Readiness
            </AppText>
            <View style={styles.gaugeRow}>
              <RingGauge label="Recovery" value={displayRecoveryScore} color={LiftFlowColors.success} />
              <RingGauge label="Readiness" value={readinessScore} color={LiftFlowColors.accent} />
            </View>
          </Card>
        )}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(120).duration(400)}>
        {summaryLoading && !user?.metadata?.coachActivation?.coachMessage ? (
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
                <AppText variant="bodyBold">{coachHeadline}</AppText>
                <AppText variant="footnote" color="textSecondary">
                  {coachMessage}
                </AppText>
              </View>
            </LinearGradient>
          </View>
        )}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(180).duration(400)}>
        {programLoading ? (
          <Card style={styles.emptyWorkout} glow>
            <SkeletonBlock height={160} />
            <SkeletonBlock height={22} width="55%" />
            <SkeletonBlock height={14} width="35%" />
            <SkeletonBlock height={48} />
          </Card>
        ) : nextPlanned ? (
          <WorkoutHeroCard
            title={nextPlanned.name}
            durationMin={
              (nextPlanned.metadata?.exercises?.length ?? 0) > 0
                ? Math.max(30, Math.round((nextPlanned.metadata?.exercises?.length ?? 6) * 8))
                : user?.metadata?.coachProfile?.minutesPerWorkout ?? 60
            }
            onStart={() => handleStartNextWorkout(nextPlanned)}
            loading={startingWorkout}
          />
        ) : user?.onboardingCompleted ? (
          <Card style={styles.emptyWorkout} glow>
            <AppText variant="bodyBold">Your coach is syncing</AppText>
            <AppText variant="footnote" color="textSecondary">
              Pull to refresh — your program should appear momentarily.
            </AppText>
            <PrimaryButton label="Refresh Plan" onPress={() => { setRefreshing(true); load(); }} />
          </Card>
        ) : (
          <Card style={styles.emptyWorkout} glow>
            <AppText variant="bodyBold">No workout scheduled</AppText>
            <AppText variant="footnote" color="textSecondary">
              Start a session or set up your training program.
            </AppText>
            <PrimaryButton label="Go to Workout" onPress={() => router.push('/(tabs)/workout')} />
          </Card>
        )}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(240).duration(400)}>
        {summaryLoading && !data ? (
          <Card style={styles.statsCard}>
            <SkeletonBlock height={14} width="25%" />
            <View style={styles.statRow}>
              <SkeletonBlock height={56} style={styles.statSkeleton} />
              <SkeletonBlock height={56} style={styles.statSkeleton} />
              <SkeletonBlock height={56} style={styles.statSkeleton} />
            </View>
          </Card>
        ) : (
          <Card style={styles.statsCard}>
            <AppText variant="label" color="accent">
              Today
            </AppText>
            <View style={styles.statRow}>
              <StatPill label="Calories" value={`${data?.caloriesToday ?? 0}${calorieTarget ? `/${calorieTarget}` : ''}`} />
              <StatPill label="Protein" value={`${Math.round(data?.proteinToday ?? 0)}g${proteinTarget ? `/${proteinTarget}g` : ''}`} accent />
              <StatPill label="Streak" value={`${data?.streak ?? 0}d`} />
            </View>
          </Card>
        )}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300).duration(400)}>
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
              Current weight · {data?.weeklyWorkouts ?? 0} workouts this week
            </AppText>
          </Card>
        )}
      </Animated.View>

      {insight ? (
        <Animated.View entering={FadeInDown.delay(360).duration(400)}>
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

function StatPill({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={[styles.statPill, accent && styles.statPillAccent]}>
      <AppText variant="caption" color="textTertiary">
        {label}
      </AppText>
      <AppText variant="bodyBold" color={accent ? 'accent' : 'textPrimary'}>
        {value}
      </AppText>
    </View>
  );
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
  statsCard: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statSkeleton: {
    flex: 1,
  },
  statPill: {
    flex: 1,
    backgroundColor: LiftFlowColors.backgroundSecondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  statPillAccent: {
    borderColor: LiftFlowColors.accent,
    backgroundColor: LiftFlowColors.accentGlow,
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
