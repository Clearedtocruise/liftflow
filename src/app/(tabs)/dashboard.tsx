import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTodayDashboard } from '@/hooks/useTodayDashboard';
import { exercisesFromPlannedWorkout } from '@/lib/workoutPlan';

export default function DashboardScreen() {
  const { user, isProfileHydrated } = useAuth();
  const {
    todaysWorkout,
    loading,
    error,
    hasProgram,
    starting,
    generating,
    refresh,
    startWorkout,
    generateWorkout,
  } = useTodayDashboard();

  // Waits for the real profile: the optimistic stub reports onboarding as complete, so acting on
  // it here would let a new user briefly land on a dashboard they should not see yet.
  useEffect(() => {
    if (isProfileHydrated && user && !user.onboardingCompleted) {
      router.replace('/(onboarding)/legal');
    }
  }, [isProfileHydrated, user]);

  async function handleStart() {
    const ok = await startWorkout();
    if (ok) router.push('/(tabs)/workout');
  }

  async function handleGenerate() {
    await generateWorkout();
  }

  const previewExercises = exercisesFromPlannedWorkout(todaysWorkout);

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <AppText variant="headline">Today</AppText>
      </View>

      <Card style={styles.mainCard} glow>
        <AppText variant="label" color="textSecondary">
          Today's workout
        </AppText>

        {loading ? (
          <ActivityIndicator color={LiftFlowColors.accent} style={styles.loader} />
        ) : error ? (
          <>
            <AppText variant="title">Can't load today</AppText>
            <AppText variant="footnote" color="textSecondary">
              We couldn't reach your training plan. Check your connection and try again.
            </AppText>
            <PrimaryButton label="Try again" onPress={() => void refresh()} size="large" />
          </>
        ) : todaysWorkout ? (
          <>
            <AppText variant="title">{todaysWorkout.name}</AppText>
            {previewExercises.length > 0 ? (
              <View style={styles.previewBlock}>
                <AppText variant="caption" color="textSecondary">
                  Exercise preview
                </AppText>
                {previewExercises.slice(0, 4).map((exercise, index) => (
                  <AppText
                    key={`${exercise.exerciseId ?? exercise.name ?? 'exercise'}-${index}`}
                    variant="footnote"
                    color="textSecondary">
                    {index + 1}. {exercise.name}
                  </AppText>
                ))}
                {previewExercises.length > 4 ? (
                  <AppText variant="caption" color="textTertiary">
                    +{previewExercises.length - 4} more
                  </AppText>
                ) : null}
              </View>
            ) : null}
            <PrimaryButton
              label="Start"
              onPress={handleStart}
              loading={starting}
              disabled={starting}
              size="large"
            />
          </>
        ) : !hasProgram ? (
          <>
            <AppText variant="title">Let's build your plan</AppText>
            <AppText variant="footnote" color="textSecondary">
              You don't have a training program yet. Generate your first week to get started.
            </AppText>
            <PrimaryButton
              label="Build my plan"
              onPress={handleGenerate}
              loading={generating}
              disabled={generating}
              size="large"
            />
          </>
        ) : (
          <>
            <AppText variant="title">Rest day</AppText>
            <AppText variant="footnote" color="textSecondary">
              Nothing scheduled today. Generate an extra session if you want to train anyway.
            </AppText>
            <PrimaryButton
              label="Generate workout"
              onPress={handleGenerate}
              loading={generating}
              disabled={generating}
              size="large"
            />
          </>
        )}
      </Card>

      <View style={styles.actions}>
        <SecondaryAction
          label="Log workout"
          onPress={() => router.push('/(tabs)/workout/manual-log')}
        />
        <SecondaryAction
          label="Log a meal"
          onPress={() => router.push('/(tabs)/nutrition?log=1')}
        />
        <SecondaryAction
          label="Body check-in"
          onPress={() => router.push('/(features)/recovery-check-in')}
        />
        <SecondaryAction label="View history" onPress={() => router.push('/(tabs)/history')} />
      </View>
    </ScreenContainer>
  );
}

function SecondaryAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionRow, pressed && styles.actionPressed]}
      accessibilityRole="button">
      <AppText variant="bodyBold">{label}</AppText>
      <AppText variant="footnote" color="textTertiary">
        ›
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: Spacing.md,
  },
  mainCard: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
  },
  loader: {
    marginVertical: Spacing.lg,
  },
  previewBlock: {
    gap: Spacing.xs,
  },
  actions: {
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: LiftFlowColors.surface,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.border,
  },
  actionPressed: {
    opacity: 0.85,
  },
});
