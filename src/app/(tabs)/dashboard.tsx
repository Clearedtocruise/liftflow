import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { CoachInsightCard } from '@/components/dashboard/CoachInsightCard';
import { HomeHeader } from '@/components/dashboard/HomeHeader';
import { QuickActionGrid, type QuickAction } from '@/components/dashboard/QuickActionGrid';
import { StatTile } from '@/components/dashboard/StatTile';
import { TodayHeroCard, type HeroState } from '@/components/dashboard/TodayHeroCard';
import { UpNextCard } from '@/components/dashboard/UpNextCard';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useHomeMetrics } from '@/hooks/useHomeMetrics';
import { useTodayDashboard } from '@/hooks/useTodayDashboard';
import { profileFigureGender, resolveExerciseMuscles } from '@/lib/exerciseMuscleMap';
import { exercisesFromPlannedWorkout } from '@/lib/workoutPlan';

function formatSleep(hours?: number): string | undefined {
  if (hours == null) return undefined;
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  return minutes === 0 ? `${whole}h` : `${whole}h ${minutes}m`;
}

export default function DashboardScreen() {
  const { user, isProfileHydrated } = useAuth();
  const {
    todaysWorkout,
    upcomingWorkout,
    loading,
    error,
    hasProgram,
    starting,
    generating,
    refresh,
    startWorkout,
    generateWorkout,
  } = useTodayDashboard();
  const metrics = useHomeMetrics();

  // Waits for the real profile: the optimistic stub reports onboarding as complete, so acting on
  // it here would let a new user briefly land on a dashboard they should not see yet.
  useEffect(() => {
    if (isProfileHydrated && user && !user.onboardingCompleted) {
      router.replace('/(onboarding)/legal');
    }
  }, [isProfileHydrated, user]);

  const heroState: HeroState = useMemo(() => {
    if (loading) return { kind: 'loading' };
    if (error) return { kind: 'error' };
    if (todaysWorkout) {
      const exercises = exercisesFromPlannedWorkout(todaysWorkout);
      return {
        kind: 'workout',
        name: todaysWorkout.name,
        exercises: exercises.slice(0, 4).map((exercise) => exercise.name),
        extraCount: Math.max(exercises.length - 4, 0),
      };
    }
    if (!hasProgram) return { kind: 'no-program' };
    return { kind: 'rest' };
  }, [loading, error, todaysWorkout, hasProgram]);

  const upNextMuscles = useMemo(
    () => (upcomingWorkout ? resolveExerciseMuscles(upcomingWorkout.name) : null),
    [upcomingWorkout],
  );

  /**
   * Shortcuts to tasks, not copies of the tab bar: logging a past session and recording a check-in
   * both live several taps deep, which is why they earn a place here.
   */
  const quickActions: QuickAction[] = useMemo(
    () => [
      {
        label: 'Log Workout',
        icon: '🏋',
        accent: 'streak',
        onPress: () => router.push('/(tabs)/workout/manual-log'),
      },
      {
        label: 'Log Meal',
        icon: '🍽',
        accent: 'nutrition',
        onPress: () => router.push('/(tabs)/nutrition'),
      },
      {
        label: 'Progress Photo',
        icon: '📷',
        accent: 'coach',
        onPress: () => router.push('/(tabs)/progress'),
      },
      {
        label: 'Body Check-In',
        icon: '❤',
        accent: 'body',
        onPress: () => router.push('/(features)/recovery-check-in'),
      },
    ],
    [],
  );

  return (
    <ScreenContainer contentContainerStyle={styles.content}>
      <HomeHeader
        displayName={user?.displayName}
        streakDays={metrics.loading ? undefined : metrics.streak.value}
        onPressStreak={() => router.push('/(tabs)/history')}
        onPressSettings={() => router.push('/(tabs)/settings')}
      />

      <TodayHeroCard
        state={heroState}
        hrvMs={metrics.hrvMs.value}
        recoveryPercent={metrics.recoveryScorePercent}
        recoveryLabel={metrics.recoveryScoreLabel}
        busy={starting || generating}
        onStart={() => {
          void startWorkout().then((ok) => {
            if (ok) router.push('/(tabs)/workout');
          });
        }}
        onGenerate={() => void generateWorkout()}
        onRetry={() => void refresh()}
        onOpenRecovery={() => router.push('/(features)/recovery-check-in')}
        onManageWorkout={() => {
          if (!todaysWorkout) return;
          router.push({
            pathname: '/(tabs)/workout/day',
            params: { id: todaysWorkout.id },
          });
        }}
      />

      <View style={styles.tiles}>
        <StatTile
          label="Recovery"
          value={metrics.recovery.value != null ? `${metrics.recovery.value}%` : undefined}
          caption={metrics.recoveryScoreLabel ?? 'Check in'}
          accent="recovery"
          history={metrics.recovery.history}
          emptyHint="Check in to score"
          onPress={() => router.push('/(features)/recovery-check-in')}
        />
        <StatTile
          label="Sleep"
          value={formatSleep(metrics.sleepHours.value)}
          caption={metrics.sleepHours.value != null && metrics.sleepHours.value >= 7 ? 'Good' : 'Short'}
          accent="sleep"
          history={metrics.sleepHours.history}
          emptyHint={metrics.healthEmpty ? 'Connect Apple Health' : 'No data yet'}
          onPress={() => router.push('/(features)/healthkit')}
        />
      </View>

      <View style={styles.tiles}>
        <StatTile
          label="Calories"
          value={metrics.activeCalories.value != null ? String(Math.round(metrics.activeCalories.value)) : undefined}
          caption="Active"
          accent="energy"
          history={metrics.activeCalories.history}
          emptyHint={metrics.healthEmpty ? 'Connect Apple Health' : 'No data yet'}
          onPress={() => router.push('/(features)/healthkit')}
        />
        <StatTile
          label="Streak"
          value={metrics.streak.value != null ? String(metrics.streak.value) : undefined}
          caption={metrics.streak.value === 1 ? 'day' : 'days'}
          accent="streak"
          chart="bars"
          emptyHint="Log a workout"
          onPress={() => router.push('/(tabs)/history')}
        />
      </View>

      {metrics.coachInsight ? (
        <CoachInsightCard
          insight={metrics.coachInsight}
          onPress={() => router.push('/(tabs)/coaching')}
        />
      ) : null}

      <View style={styles.section}>
        <AppText variant="label" color="textTertiary">
          QUICK ACTIONS
        </AppText>
        <QuickActionGrid actions={quickActions} />
      </View>

      {upcomingWorkout && upNextMuscles ? (
        <View style={styles.section}>
          <AppText variant="label" color="textTertiary">
            UP NEXT
          </AppText>
          <UpNextCard
            when={upcomingWorkout.when}
            name={upcomingWorkout.name}
            focus={upcomingWorkout.focus}
            muscles={upNextMuscles}
            gender={profileFigureGender(user?.sex)}
            onPress={() => router.push('/(tabs)/workout')}
          />
        </View>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.md,
    paddingBottom: Spacing.huge,
  },
  tiles: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  section: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
});
