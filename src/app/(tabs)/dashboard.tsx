import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { LogoMark } from '@/components/brand/LogoMark';
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
import { useSubscription } from '@/hooks/useSubscription';
import { useInsightRotator } from '@/hooks/useInsightRotator';
import { useUnits } from '@/hooks/useUnits';
import { useWorkoutLocations } from '@/hooks/useWorkoutLocations';
import { analyticsService } from '@/services/analyticsService';
import { nutritionService } from '@/services/nutritionService';
import { recoveryService } from '@/services/recoveryService';
import { trainingService } from '@/services/trainingService';
import { useWorkoutSession } from '@/state/workout/WorkoutSessionContext';
import type { DashboardSummary, NutritionGoals, PlannedWorkout, ProgramDashboard } from '@/types';

export default function DashboardScreen() {
  const { user } = useAuth();
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [startingWorkout, setStartingWorkout] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [dashResult, programResult, goalsResult, recoveryResult] = await Promise.all([
      analyticsService.getDashboard(user.id),
      trainingService.getDashboard(user.id),
      nutritionService.getGoals(user.id),
      isPremium ? recoveryService.getIntelligence(user.id) : recoveryService.getToday(user.id),
    ]);
    if (dashResult.success) setData(dashResult.data);
    if (programResult.success) setProgram(programResult.data);
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
    setLoading(false);
    setRefreshing(false);
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
  const firstName = user?.displayName?.split(' ')[0] ?? 'Athlete';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

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

  if (loading) {
    return (
      <View style={styles.loading}>
        <LogoMark size={64} />
        <ActivityIndicator color={LiftFlowColors.primary} style={styles.loader} />
      </View>
    );
  }

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={LiftFlowColors.primary} />
      }>
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <AppText variant="headline">
          {greeting}, {firstName} 👋
        </AppText>
        <AppText variant="footnote" color="textSecondary">
          {Brand.taglinePrimary}
        </AppText>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(60).duration(400)}>
        <Card style={styles.recoveryCard} glow>
          <AppText variant="label" color="accent">
            Recovery & Readiness
          </AppText>
          <View style={styles.gaugeRow}>
            <RingGauge label="Recovery" value={displayRecoveryScore} color={LiftFlowColors.success} />
            <RingGauge label="Readiness" value={readinessScore} color={LiftFlowColors.accent} />
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(120).duration(400)}>
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
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(180).duration(400)}>
        {nextPlanned ? (
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
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300).duration(400)}>
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
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LiftFlowColors.background,
  },
  loader: {
    marginTop: Spacing.lg,
  },
  header: {
    gap: Spacing.xs,
    marginBottom: Spacing.xxl,
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
});
