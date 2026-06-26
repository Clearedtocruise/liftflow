import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import type { AppTheme, ThemeColorPalette } from '@/constants/themes';
import { useThemedStyles } from '@/hooks/useLiftFlowTheme';

type MetricTileProps = {
  label: string;
  children: ReactNode;
  footer?: string;
  footerColor?: keyof ThemeColorPalette;
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
}: MetricTileProps) {
  const styles = useThemedStyles(createStyles);

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

export const MetricTile = StatCard;

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    flex: {
      flex: 1,
    },
    card: {
      flex: 1,
      alignItems: 'center',
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.lg,
    },
  });
}
