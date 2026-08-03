import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, MetricAccents, Radius, Spacing, type MetricAccent } from '@/constants/theme';

type AddOption = {
  label: string;
  detail: string;
  icon: string;
  accent: MetricAccent;
  href: string;
};

/**
 * Everything the centre tab button can create. Each row replaces this screen rather than stacking on
 * top of it, so backing out of the destination returns to where the user opened the sheet from.
 */
const OPTIONS: AddOption[] = [
  {
    label: 'Start Today\u2019s Workout',
    detail: 'Jump straight into your scheduled session',
    icon: '🏋',
    accent: 'streak',
    href: '/(tabs)/workout',
  },
  {
    label: 'Log a Past Workout',
    detail: 'Record training you did away from the app',
    icon: '📝',
    accent: 'coach',
    href: '/(tabs)/workout/manual-log',
  },
  {
    label: 'Log a Meal',
    detail: 'Add food to today\u2019s nutrition',
    icon: '🍽',
    accent: 'nutrition',
    href: '/(tabs)/nutrition',
  },
  {
    label: 'Log Cardio or Activity',
    detail: 'Runs, rides, walks and classes',
    icon: '🏃',
    accent: 'energy',
    href: '/(features)/log-activity',
  },
  {
    label: 'Body Check-In',
    detail: 'Sleep, soreness and stress for today\u2019s score',
    icon: '❤',
    accent: 'body',
    href: '/(features)/recovery-check-in',
  },
  {
    label: 'Progress Photo',
    detail: 'Add a photo to your transformation timeline',
    icon: '📷',
    accent: 'sleep',
    href: '/(tabs)/progress',
  },
];

export default function QuickAddScreen() {
  return (
    <ScreenContainer contentContainerStyle={styles.content}>
      <AppText variant="footnote" color="textTertiary">
        What would you like to add?
      </AppText>

      {OPTIONS.map((option) => {
        const { tint, glow } = MetricAccents[option.accent];
        return (
          <Pressable
            key={option.label}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityHint={option.detail}
            onPress={() => router.replace(option.href as never)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <View style={[styles.iconWrap, { backgroundColor: glow, borderColor: tint }]}>
              <AppText variant="callout" style={{ color: tint }}>
                {option.icon}
              </AppText>
            </View>
            <View style={styles.body}>
              <AppText variant="bodyBold">{option.label}</AppText>
              <AppText variant="caption" color="textTertiary">
                {option.detail}
              </AppText>
            </View>
            <AppText variant="body" color="textTertiary">
              ›
            </AppText>
          </Pressable>
        );
      })}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.sm,
    paddingBottom: Spacing.huge,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    backgroundColor: LiftFlowColors.surface,
  },
  pressed: {
    opacity: 0.85,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  body: {
    flex: 1,
    gap: 2,
  },
});
