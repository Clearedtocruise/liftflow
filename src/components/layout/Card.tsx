import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View, type ViewProps } from 'react-native';

import type { AppTheme } from '@/constants/themes';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useThemedStyles } from '@/hooks/useLiftFlowTheme';

type CardProps = ViewProps & {
  elevated?: boolean;
  accent?: boolean;
  glow?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  children: ReactNode;
};

export function Card({ elevated, accent, glow, onPress, onLongPress, style, children, ...rest }: CardProps) {
  const styles = useThemedStyles(createStyles);

  const content = (
    <View
      style={[
        styles.card,
        elevated && styles.elevated,
        accent && styles.accent,
        glow && styles.glow,
        style,
      ]}
      {...rest}>
      {children}
    </View>
  );

  if (onPress || onLongPress) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        style={({ pressed }) => [pressed && styles.pressed]}
        accessibilityRole="button">
        {content}
      </Pressable>
    );
  }

  return content;
}

/** Premium white card — Light Professional styling via shared Card. */
export function PremiumCard(props: CardProps) {
  return <Card elevated glow {...props} />;
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.lg,
      ...theme.shadows.card,
    },
    elevated: {
      backgroundColor: theme.colors.surfaceElevated,
    },
    accent: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryGlow,
    },
    glow: {
      borderColor: theme.isDark ? 'rgba(14, 144, 255, 0.28)' : 'rgba(22, 119, 255, 0.22)',
      ...theme.shadows.glow,
    },
    pressed: {
      opacity: 0.92,
      transform: [{ scale: 0.99 }],
    },
  });
}
