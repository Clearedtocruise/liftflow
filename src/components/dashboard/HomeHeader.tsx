import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, MetricAccents, Radius, Spacing } from '@/constants/theme';

type HomeHeaderProps = {
  displayName?: string;
  /** Undefined until the streak has loaded; 0 is a real answer and shows as "start one". */
  streakDays?: number;
  onPressStreak: () => void;
};

function greeting(hour: number): string {
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
}

export function HomeHeader({ displayName, streakDays, onPressStreak }: HomeHeaderProps) {
  const hour = new Date().getHours();

  return (
    <View style={styles.root}>
      <View style={styles.greetingBlock}>
        <AppText variant="body" color="textSecondary">
          {greeting(hour)},
        </AppText>
        {/* Falls back to the greeting alone rather than to "there" or an email local-part. */}
        {displayName ? (
          <AppText variant="hero" color="accent" numberOfLines={1}>
            {displayName}
          </AppText>
        ) : null}
        <AppText variant="footnote" color="textTertiary">
          Ready to become 1% better today?
        </AppText>
      </View>

      {streakDays != null ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            streakDays > 0 ? `${streakDays} day streak. View history.` : 'No streak yet. View history.'
          }
          onPress={onPressStreak}
          style={({ pressed }) => [styles.streak, pressed && styles.pressed]}>
          <AppText variant="body">{streakDays > 0 ? '🔥' : '·'}</AppText>
          <View>
            <AppText variant="bodyBold">{streakDays > 0 ? String(streakDays) : 'Start'}</AppText>
            <AppText variant="label" color="textTertiary">
              {streakDays === 1 ? 'day streak' : streakDays > 0 ? 'day streak' : 'a streak'}
            </AppText>
          </View>
          <AppText variant="footnote" color="textTertiary">
            ›
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  greetingBlock: {
    flex: 1,
    gap: 2,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    backgroundColor: MetricAccents.energy.glow,
    marginTop: Spacing.lg,
  },
  pressed: {
    opacity: 0.75,
  },
});
