import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewProps } from 'react-native';

import { LiftFlowColors, Radius, Shadows, Spacing } from '@/constants/theme';

type CardProps = ViewProps & {
  elevated?: boolean;
  accent?: boolean;
  glow?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  children: ReactNode;
};

export function Card({ elevated, accent, glow, onPress, onLongPress, style, children, ...rest }: CardProps) {
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: LiftFlowColors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    padding: Spacing.lg,
    ...Shadows.card,
  },
  elevated: {
    backgroundColor: LiftFlowColors.surfaceElevated,
  },
  accent: {
    borderColor: LiftFlowColors.primary,
    backgroundColor: LiftFlowColors.primaryGlow,
  },
  glow: {
    borderColor: 'rgba(14, 144, 255, 0.28)',
    ...Shadows.glow,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
});
