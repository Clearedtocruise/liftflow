import { Pressable, StyleSheet, View } from 'react-native';

import { LiftFlowLogo } from '@/components/brand/LiftFlowLogo';
import { AppSymbol, SYMBOL_FALLBACKS } from '@/components/ui/AppSymbol';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, MetricAccents, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { greetingForHour, greetingName } from '@/lib/homeGreeting';

type HomeHeaderProps = {
  displayName?: string;
  /** Undefined until the streak has loaded; 0 is a real answer and shows as "start one". */
  streakDays?: number;
  onPressStreak: () => void;
  onPressSettings: () => void;
};

export function HomeHeader({
  displayName,
  streakDays,
  onPressStreak,
  onPressSettings,
}: HomeHeaderProps) {
  const hour = new Date().getHours();
  const name = greetingName(displayName);
  const greet = greetingForHour(hour);

  return (
    <View style={styles.root}>
      <View style={styles.topRow}>
        <View style={styles.greetingBlock}>
          {/* Time-of-day and name on separate lines so the brand lockup cannot clip "Good Morning, Timothy". */}
          <AppText variant="hero" color="accent" style={styles.greetingLine}>
            {name ? `${greet},` : greet}
          </AppText>
          {name ? (
            <AppText variant="hero" color="accent" numberOfLines={1} style={styles.nameLine}>
              {name}
            </AppText>
          ) : null}
          <AppText variant="footnote" color="textTertiary">
            Ready to become 1% better today?
          </AppText>
          {streakDays != null ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                streakDays > 0
                  ? `${streakDays} day streak. View history.`
                  : 'No streak yet. View history.'
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

        <View style={styles.brandBlock}>
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
          {/* Compact lockup — keeps brand visible without eating the greeting column. */}
          <View
            accessible
            accessibilityRole="header"
            accessibilityLabel="ONE MORE Fitness"
            style={styles.lockup}>
            <LiftFlowLogo size={18} variant="primary" />
            <View style={styles.wordmark}>
              <AppText variant="label" style={styles.brandPrimary} numberOfLines={1}>
                ONE MORE
              </AppText>
              <AppText variant="label" style={styles.brandSecondary} numberOfLines={1}>
                FITNESS
              </AppText>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginBottom: Spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  greetingBlock: {
    flex: 1,
    gap: Spacing.xs,
    minWidth: 0,
  },
  greetingLine: {
    fontSize: 26,
    lineHeight: 32,
  },
  nameLine: {
    fontSize: 28,
    lineHeight: 34,
    marginTop: -2,
  },
  brandBlock: {
    flexShrink: 0,
    alignItems: 'flex-end',
    gap: Spacing.sm,
    maxWidth: 96,
  },
  iconButton: {
    minWidth: TouchTarget.min,
    minHeight: 28,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  lockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  wordmark: {
    alignItems: 'flex-start',
  },
  brandPrimary: {
    color: LiftFlowColors.restTimer,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  brandSecondary: {
    color: LiftFlowColors.textTertiary,
    fontSize: 6,
    lineHeight: 8,
    letterSpacing: 1.2,
  },
  streak: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: TouchTarget.min,
    marginTop: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
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
