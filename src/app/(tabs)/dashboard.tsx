import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, StyleSheet, View } from 'react-native';

import { HistoryCard } from '@/components/history/HistoryCard';
import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { ProgramDashboardCard } from '@/components/program/ProgramDashboardCard';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { pickDefaultLocation } from '@/constants/trainingProfile';
import { useAuth } from '@/hooks/useAuth';
import { useWorkoutLocations } from '@/hooks/useWorkoutLocations';
import { aiService } from '@/services/aiService';
import { analyticsService } from '@/services/analyticsService';
import { trainingService } from '@/services/trainingService';
import { useWorkoutSession } from '@/state/workout/WorkoutSessionContext';
import type { DashboardSummary, PlannedWorkout, ProgramDashboard } from '@/types';

function kgToLbs(kg?: number): string {
  if (!kg) return '—';
  return `${Math.round(kg * 2.20462)} lbs`;
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const { startSessionFromPlanned } = useWorkoutSession();
  const { locations, selectedId } = useWorkoutLocations(user?.id);
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [program, setProgram] = useState<ProgramDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adapting, setAdapting] = useState(false);
  const [startingWorkout, setStartingWorkout] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [dashResult, programResult] = await Promise.all([
      analyticsService.getDashboard(user.id),
      trainingService.getDashboard(user.id),
    ]);
    if (dashResult.success) setData(dashResult.data);
    if (programResult.success) setProgram(programResult.data);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRefreshCoaching() {
    if (!user) return;
    await aiService.refreshCoaching(user.id);
    router.push('/(tabs)/coaching');
  }

  async function handleAdaptProgram() {
    if (!user) return;
    setAdapting(true);
    await trainingService.adaptProgram(user.id);
    setAdapting(false);
    load();
  }

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

    if (started) {
      router.push('/(tabs)/workout');
      return;
    }
    Alert.alert('Could not start workout', 'Unable to start the planned workout session.');
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={LiftFlowColors.accent} />
      </View>
    );
  }

  return (
    <ScreenContainer
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={LiftFlowColors.accent} />}>
      <View style={styles.header}>
        <AppText variant="caption" color="accent">
          Dashboard
        </AppText>
        <AppText variant="title">Welcome{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}</AppText>
      </View>

      <ProgramDashboardCard
        dashboard={program}
        onAdapt={handleAdaptProgram}
        onStartNextWorkout={handleStartNextWorkout}
        startingWorkout={startingWorkout}
        adapting={adapting}
      />

      <View style={styles.statsGrid}>
        <Card style={styles.statCard}>
          <AppText variant="caption" color="textSecondary">
            Current Weight
          </AppText>
          <AppText variant="metric">{kgToLbs(data?.currentWeightKg)}</AppText>
        </Card>
        <Card style={styles.statCard}>
          <AppText variant="caption" color="textSecondary">
            Goal Weight
          </AppText>
          <AppText variant="metric">{data?.goalWeightKg ? `${data.goalWeightKg} lbs` : '—'}</AppText>
        </Card>
        <Card style={styles.statCard}>
          <AppText variant="caption" color="textSecondary">
            Weekly Workouts
          </AppText>
          <AppText variant="metric" color="accent">
            {data?.weeklyWorkouts ?? 0}
          </AppText>
        </Card>
        <Card style={styles.statCard}>
          <AppText variant="caption" color="textSecondary">
            Streak
          </AppText>
          <AppText variant="metric">{data?.streak ?? 0} days</AppText>
        </Card>
      </View>

      <View style={styles.nutritionRow}>
        <Card style={styles.nutritionCard}>
          <AppText variant="caption" color="textSecondary">
            Calories Today
          </AppText>
          <AppText variant="bodyBold">{data?.caloriesToday ?? 0}</AppText>
        </Card>
        <Card style={styles.nutritionCard}>
          <AppText variant="caption" color="textSecondary">
            Protein Today
          </AppText>
          <AppText variant="bodyBold">{Math.round(data?.proteinToday ?? 0)}g</AppText>
        </Card>
      </View>

      {data?.weightHistory && data.weightHistory.length > 1 ? (
        <>
          <SectionHeader title="Weight Trend" subtitle="Last 30 entries" />
          <Card>
            {data.weightHistory.slice(-5).map((point) => (
              <View key={point.date} style={styles.trendRow}>
                <AppText variant="footnote" color="textSecondary">
                  {new Date(point.date).toLocaleDateString()}
                </AppText>
                <AppText variant="bodyBold">{kgToLbs(point.weightKg)}</AppText>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeader title="Recent Workouts" />
      {(data?.recentWorkouts ?? []).length === 0 ? (
        <AppText variant="body" color="textSecondary">
          No workouts yet. Start your first session.
        </AppText>
      ) : (
        data?.recentWorkouts.map((item) => <HistoryCard key={item.id} item={item} />)
      )}

      <View style={styles.actions}>
        <PrimaryButton label="AI Coaching" onPress={handleRefreshCoaching} variant="secondary" />
      </View>
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
  header: {
    gap: Spacing.xs,
    marginBottom: Spacing.xxl,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statCard: {
    width: '47%',
    gap: Spacing.xs,
    paddingVertical: Spacing.lg,
  },
  nutritionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  nutritionCard: {
    flex: 1,
    gap: Spacing.xs,
    paddingVertical: Spacing.lg,
  },
  trendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  actions: {
    marginTop: Spacing.xxl,
    marginBottom: Spacing.xl,
  },
});
