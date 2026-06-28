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
  /** Narrow three-up rows — tighter copy and single-line labels. */
  density?: 'default' | 'compact';
};

/** Compact metric tile for dashboard and history summaries. */
export function StatCard({
  label,
  children,
  footer,
  footerColor = 'textSecondary',
  onPress,
  style,
  density = 'default',
}: MetricTileProps) {
  const styles = useThemedStyles(createStyles);
  const compact = density === 'compact';

  const card = (
    <Card style={[styles.card, compact && styles.cardCompact, style]}>
      <AppText
        variant={compact ? 'caption' : 'label'}
        color="textTertiary"
        align="center"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        style={compact ? styles.labelCompact : styles.labelDefault}>
        {label}
      </AppText>
      {children}
      {footer ? (
        <AppText
          variant="caption"
          color={footerColor}
          align="center"
          numberOfLines={compact ? 1 : 2}
          adjustsFontSizeToFit={compact}
          minimumFontScale={0.8}
          style={compact ? styles.footerCompact : undefined}>
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
      minWidth: 0,
    },
    card: {
      flex: 1,
      alignItems: 'center',
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.lg,
      paddingHorizontal: theme.spacing.xs,
    },
    cardCompact: {
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.xs,
      gap: 4,
    },
    labelDefault: {
      width: '100%',
    },
    labelCompact: {
      width: '100%',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      fontSize: 10,
      lineHeight: 12,
    },
    footerCompact: {
      width: '100%',
      fontSize: 11,
      lineHeight: 13,
    },
  });
}
