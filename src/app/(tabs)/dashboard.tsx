import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { CoachInsightCard } from '@/components/dashboard/CoachInsightCard';
import { HomeHeader } from '@/components/dashboard/HomeHeader';
import { StatTile } from '@/components/dashboard/StatTile';
import { TodayHeroCard, type HeroState } from '@/components/dashboard/TodayHeroCard';
import { UpNextCard } from '@/components/dashboard/UpNextCard';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useHomeMetrics } from '@/hooks/useHomeMetrics';
import { useTodayDashboard } from '@/hooks/useTodayDashboard';
import { describeProteinBudget } from '@/lib/calorieBudget';
import { resolveExerciseMuscles } from '@/lib/exerciseMuscleMap';
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
    completedTodaysWorkout,
    inProgressTodaysWorkout,
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
    if (completedTodaysWorkout) {
      return { kind: 'completed', name: completedTodaysWorkout.name };
    }
    if (inProgressTodaysWorkout) {
      const exercises = exercisesFromPlannedWorkout(inProgressTodaysWorkout);
      return {
        kind: 'in-progress',
        name: inProgressTodaysWorkout.name,
        exercises: exercises.slice(0, 4).map((exercise) => exercise.name),
        extraCount: Math.max(exercises.length - 4, 0),
      };
    }
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
  }, [loading, error, todaysWorkout, completedTodaysWorkout, inProgressTodaysWorkout, hasProgram]);

  const upNextMuscles = useMemo(
    () => (upcomingWorkout ? resolveExerciseMuscles(upcomingWorkout.name) : null),
    [upcomingWorkout],
  );

  // Protein over calories on the home tile: it is the macro that decides whether the training
  // actually turns into muscle. Calories stay on the nutrition screen alongside it.
  const protein = useMemo(
    () => describeProteinBudget(metrics.nutrition.proteinG, metrics.nutrition.proteinTargetG),
    [metrics.nutrition.proteinG, metrics.nutrition.proteinTargetG],
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
        onContinueWorkout={() => router.push('/(tabs)/workout')}
        onGenerate={() => void generateWorkout()}
        onRetry={() => void refresh()}
        onOpenRecovery={() => router.push('/(features)/recovery-check-in')}
        onViewHistory={() => router.push('/(tabs)/history')}
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
          // Viewing the trend, not recording one — the hero button owns the check-in itself.
          onPress={() => router.push('/(features)/recovery-analysis')}
        />
        <StatTile
          label="Sleep"
          value={formatSleep(metrics.sleepHours.value)}
          caption={metrics.sleepHours.value != null && metrics.sleepHours.value >= 7 ? 'Good' : 'Short'}
          accent="sleep"
          history={metrics.sleepHours.history}
          emptyHint={
            metrics.healthEmpty ? 'Connect Apple Health' : 'Check in or sync Health'
          }
          onPress={() => router.push('/(features)/healthkit')}
        />
      </View>

      <View style={styles.tiles}>
        <StatTile
          label="Burned"
          value={metrics.activeCalories.value != null ? String(Math.round(metrics.activeCalories.value)) : undefined}
          caption="Active today"
          accent="energy"
          history={metrics.activeCalories.history}
          emptyHint={metrics.healthEmpty ? 'Connect Apple Health' : 'No data yet'}
          onPress={() => router.push('/(features)/healthkit')}
        />
        <StatTile
          label="Protein"
          value={protein.value}
          caption={protein.caption}
          accent="nutrition"
          progressPercent={protein.percent}
          emptyHint={protein.emptyHint}
          onPress={() => router.push('/(tabs)/nutrition')}
        />
      </View>

      {metrics.coachInsight ? (
        <CoachInsightCard
          insight={metrics.coachInsight}
          onPress={() => router.push('/(tabs)/coaching')}
        />
      ) : null}

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
            // Opens the upcoming session itself; the Workout tab always shows today.
            onPress={() =>
              router.push({
                pathname: '/(tabs)/workout/day',
                params: { id: upcomingWorkout.workout.id },
              })
            }
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
