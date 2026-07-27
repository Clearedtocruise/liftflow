import { Pressable, StyleSheet, View } from 'react-native';

import { BrandWordmark } from '@/components/dashboard/BrandWordmark';
import { AppSymbol, SYMBOL_FALLBACKS } from '@/components/ui/AppSymbol';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, MetricAccents, Radius, Spacing, TouchTarget } from '@/constants/theme';

type HomeHeaderProps = {
  displayName?: string;
  /** Undefined until the streak has loaded; 0 is a real answer and shows as "start one". */
  streakDays?: number;
  onPressStreak: () => void;
  onPressSettings: () => void;
};

function greeting(hour: number): string {
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
}

export function HomeHeader({
  displayName,
  streakDays,
  onPressStreak,
  onPressSettings,
}: HomeHeaderProps) {
  const hour = new Date().getHours();

  return (
    <View style={styles.root}>
      <View style={styles.topRow}>
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

        <View style={styles.brandBlock}>
          {/* Settings left the tab bar to make room for the quick-add button, so it lives here. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            hitSlop={10}
            onPress={onPressSettings}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <AppSymbol
              name="gearshape.fill"
              fallback={SYMBOL_FALLBACKS['gearshape.fill']}
              size={18}
              tintColor={LiftFlowColors.textTertiary}
            />
          </Pressable>
          <BrandWordmark />
        </View>
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
          <AppText variant="bodyBold">{streakDays > 0 ? String(streakDays) : 'Start'}</AppText>
          <AppText variant="label" color="textTertiary" style={styles.streakLabel}>
            {streakDays > 0 ? 'DAY STREAK' : 'A STREAK'}
          </AppText>
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
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  greetingBlock: {
    flex: 1,
    gap: 2,
  },
  brandBlock: {
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  iconButton: {
    minWidth: TouchTarget.min,
    minHeight: 28,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  streak: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: TouchTarget.min,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    backgroundColor: MetricAccents.energy.glow,
  },
  streakLabel: {
    letterSpacing: 0.8,
  },
  pressed: {
    opacity: 0.75,
  },
});
