import type { ImageSource } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { CardLifestyleBanner } from '@/components/layout/CardLifestyleBanner';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LifestyleBannerSets } from '@/constants/imagery';
import { Spacing } from '@/constants/theme';
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
  onStartWorkout: () => void;
  onViewWorkout?: () => void;
  onManageDay?: () => void;
  onLogActivity?: () => void;
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
  onStartWorkout,
  onViewWorkout,
  onManageDay,
  onLogActivity,
  tabataModeEnabled = false,
  startingWorkout,
  adaptingPlan,
  bannerSources = LifestyleBannerSets.workout.sources,
  showBanner = true,
}: HomeTodayCardProps) {
  const theme = useAppTheme();
  const meta = [trainingLabel, startTime, durationMin ? `${durationMin} min` : null].filter(Boolean).join(' · ');
  const coachBody = whyToday?.trim() || coachMessage;
  const coachLabel = whyToday?.trim() ? 'Why today' : 'Coach';

  return (
    <View testID="today-workout-card">
      <Card style={styles.card} glow>
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
          <View style={styles.titleRow}>
            <View style={styles.titleBlock}>
              <AppText variant="label" color="accent">
                Today&apos;s workout
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
            {recoveryScore != null ? (
              <View style={[styles.scorePill, { borderColor: theme.colors.primarySoft, backgroundColor: theme.colors.primaryGlow }]}>
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

          <PrimaryButton
            label={tabataModeEnabled ? 'Start Tabata' : 'Start Workout'}
            onPress={onStartWorkout}
            loading={startingWorkout}
            size="large"
            testID="start-workout-button"
          />
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
          {onLogActivity ? (
            <PrimaryButton label="+ Activity" variant="secondary" onPress={onLogActivity} testID="log-activity-button" />
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
  body: {
    padding: Spacing.lg,
    gap: Spacing.md,
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
    minWidth: 52,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
  },
  scoreLabel: {
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  coachRow: {
    gap: 4,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  coachLabel: {
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
