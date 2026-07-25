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

export default function DashboardScreen() {
  const { user, isProfileReady } = useAuth();
  const {
    todaysWorkout,
    loading,
    starting,
    generating,
    startWorkout,
    generateWorkout,
  } = useTodayDashboard();

  useEffect(() => {
    if (isProfileReady && user && !user.onboardingCompleted) {
      router.replace('/(onboarding)/legal');
    }
  }, [isProfileReady, user]);

  async function handleStart() {
    const ok = await startWorkout();
    if (ok) router.push('/(tabs)/workout');
  }

  async function handleGenerate() {
    await generateWorkout();
  }

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
        ) : todaysWorkout ? (
          <>
            <AppText variant="title">{todaysWorkout.name}</AppText>
            <PrimaryButton
              label="Start"
              onPress={handleStart}
              loading={starting}
              disabled={starting}
              size="large"
            />
          </>
        ) : (
          <>
            <AppText variant="title">Rest day</AppText>
            <AppText variant="footnote" color="textSecondary">
              No workout scheduled. Generate one when you're ready to train.
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
