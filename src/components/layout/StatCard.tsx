import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';

type StatCardProps = {
  label: string;
  children: ReactNode;
  footer?: string;
  footerColor?: keyof typeof LiftFlowColors;
  onPress?: () => void;
  style?: ViewStyle;
};

/** Compact metric tile for dashboard and history summaries. */
export function StatCard({
  label,
  children,
  footer,
  footerColor = 'textSecondary',
  onPress,
  style,
}: StatCardProps) {
  const card = (
    <Card style={[styles.card, style]}>
      <AppText variant="label" color="textTertiary">
        {label}
      </AppText>
      {children}
      {footer ? (
        <AppText variant="caption" color={footerColor} align="center">
          {footer}
        </AppText>
      ) : null}
    </Card>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={styles.flex} accessibilityRole="button">
        {card}
      </Pressable>
    );
  }

  return <View style={styles.flex}>{card}</View>;
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  card: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.lg,
  },
});
