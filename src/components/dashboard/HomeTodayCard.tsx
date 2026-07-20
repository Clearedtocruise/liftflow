import type { ImageSource } from 'expo-image';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Card } from '@/components/layout/Card';
import { CardLifestyleBanner } from '@/components/layout/CardLifestyleBanner';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LifestyleBannerSets } from '@/constants/imagery';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';

type HomeTodayCardProps = {
  workoutTitle: string;
  coachMessage: string;
  /** When set, shown instead of generic coach copy with a “Why today” label. */
  whyToday?: string | null;
  trainingLabel?: string;
  startTime?: string;
  durationMin?: number;
  recoveryScore?: number | null;
  /** True when today's planned workout is already completed. */
  completed?: boolean;
  /** e.g. "9.7k lb" — shown after completion. */
  volumeLabel?: string | null;
  onStartWorkout: () => void;
  onViewWorkout?: () => void;
  onManageDay?: () => void;
  tabataModeEnabled?: boolean;
  startingWorkout?: boolean;
  adaptingPlan?: boolean;
  bannerSources?: readonly ImageSource[];
  /** When false, photo lives in the screen hero instead of duplicating on the card. */
  showBanner?: boolean;
};

/** One workout card: lifestyle photo + single title block + coach + CTA. */
export function HomeTodayCard({
  workoutTitle,
  coachMessage,
  whyToday,
  trainingLabel = 'Train',
  startTime,
  durationMin,
  recoveryScore,
  completed = false,
  volumeLabel,
  onStartWorkout,
  onViewWorkout,
  onManageDay,
  tabataModeEnabled = false,
  startingWorkout,
  adaptingPlan,
  bannerSources = LifestyleBannerSets.workout.sources,
  showBanner = true,
}: HomeTodayCardProps) {
  const theme = useAppTheme();
  const checkScale = useSharedValue(completed ? 1 : 0);
  const glow = useSharedValue(0);

  useEffect(() => {
    if (!completed) {
      checkScale.value = 0;
      glow.value = 0;
      return;
    }
    checkScale.value = withSequence(
      withTiming(0, { duration: 0 }),
      withTiming(1.18, { duration: 420, easing: Easing.out(Easing.back(1.6)) }),
      withTiming(1, { duration: 180 }),
    );
    glow.value = withDelay(
      200,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.35, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
  }, [checkScale, completed, glow]);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + glow.value * 0.45,
  }));

  const meta = [
    trainingLabel,
    startTime,
    durationMin ? `${durationMin} min` : null,
    completed && volumeLabel ? `Lifted ${volumeLabel}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const coachBody = completed
    ? volumeLabel
      ? `You crushed it — ${volumeLabel} in the books.`
      : 'Workout locked in. Eat, recover, come back stronger.'
    : whyToday?.trim() || coachMessage;
  const coachLabel = completed ? 'Victory' : whyToday?.trim() ? 'Why today' : 'Coach';

  return (
    <View testID="today-workout-card">
      <Card style={[styles.card, completed && styles.cardComplete]} glow>
        {showBanner ? (
          <CardLifestyleBanner
            sources={bannerSources}
            height={132}
            bleed={false}
            vibrant
            accentLine
          />
        ) : null}
        <View style={styles.body}>
          {completed ? (
            <Animated.View entering={FadeIn.duration(400)} style={styles.completeHero}>
              <Animated.View
                style={[
                  styles.glowRing,
                  { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryGlow },
                  glowStyle,
                ]}
              />
              <Animated.View
                style={[
                  styles.checkBadge,
                  { backgroundColor: theme.colors.primary, shadowColor: theme.colors.primary },
                  checkStyle,
                ]}>
                <AppText variant="headline" style={styles.checkMark}>
                  ✓
                </AppText>
              </Animated.View>
              <Animated.View entering={FadeInDown.delay(120).duration(420)}>
                <AppText variant="label" color="accent" style={styles.completeEyebrow}>
                  Workout complete
                </AppText>
                <AppText variant="headline" style={styles.completeTitle}>
                  One more in the bank
                </AppText>
              </Animated.View>
            </Animated.View>
          ) : null}

          <View style={styles.titleRow}>
            <View style={styles.titleBlock}>
              <AppText variant="label" color="accent">
                {completed ? 'Today' : "Today's workout"}
              </AppText>
              <Pressable onPress={onViewWorkout} disabled={!onViewWorkout}>
                <AppText variant="headline" style={styles.workoutTitle}>
                  {workoutTitle}
                </AppText>
              </Pressable>
              {meta ? (
                <AppText variant="footnote" color="textSecondary">
                  {meta}
                </AppText>
              ) : null}
            </View>
            {recoveryScore != null && !completed ? (
              <View
                style={[
                  styles.scorePill,
                  { borderColor: theme.colors.primarySoft, backgroundColor: theme.colors.primaryGlow },
                ]}>
                <AppText variant="caption" color="accent">
                  {Math.round(recoveryScore)}
                </AppText>
                <AppText variant="caption" color="textTertiary" style={styles.scoreLabel}>
                  recovery
                </AppText>
              </View>
            ) : null}
          </View>

          <View style={[styles.coachRow, { borderTopColor: theme.colors.borderSubtle }]}>
            <AppText variant="caption" color="textTertiary" style={styles.coachLabel}>
              {coachLabel}
            </AppText>
            <AppText variant="footnote" color="textSecondary">
              {coachBody}
            </AppText>
          </View>

          {completed ? (
            <PrimaryButton
              label="Relive it in History"
              onPress={onViewWorkout ?? onStartWorkout}
              size="large"
              testID="view-completed-workout-button"
            />
          ) : (
            <PrimaryButton
              label={tabataModeEnabled ? 'Start Tabata' : 'Start Workout'}
              onPress={onStartWorkout}
              loading={startingWorkout}
              size="large"
              testID="start-workout-button"
            />
          )}
          {onManageDay ? (
            <PrimaryButton
              label="Manage Day"
              variant="ghost"
              onPress={onManageDay}
              loading={adaptingPlan}
              disabled={adaptingPlan}
              testID="manage-day-button"
            />
          ) : null}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    padding: 0,
    gap: 0,
  },
  cardComplete: {
    borderWidth: 1,
    borderColor: 'rgba(45, 212, 191, 0.35)',
  },
  body: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  completeHero: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  glowRing: {
    position: 'absolute',
    top: 4,
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
  },
  checkBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  checkMark: {
    color: '#041016',
    fontSize: 28,
    lineHeight: 32,
  },
  completeEyebrow: {
    textAlign: 'center',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  completeTitle: {
    textAlign: 'center',
    marginTop: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  titleBlock: {
    flex: 1,
    gap: Spacing.xs,
  },
  workoutTitle: {
    lineHeight: 28,
  },
  scorePill: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    alignItems: 'center',
    minWidth: 64,
  },
  scoreLabel: {
    textTransform: 'lowercase',
  },
  coachRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.md,
    gap: Spacing.xs,
  },
  coachLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
