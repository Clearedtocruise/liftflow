import { Pressable, StyleSheet, View, type ViewProps } from 'react-native';

import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';

type CardProps = ViewProps & {
  elevated?: boolean;
  accent?: boolean;
  onPress?: () => void;
};

export function Card({ elevated, accent, onPress, style, children, ...rest }: CardProps) {
  const content = (
    <View
      style={[
        styles.card,
        elevated && styles.elevated,
        accent && styles.accent,
        style,
      ]}
      {...rest}>
      {children}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.border,
    padding: Spacing.lg,
  },
  elevated: {
    backgroundColor: LiftFlowColors.surfaceElevated,
  },
  accent: {
    borderColor: LiftFlowColors.accentMuted,
    backgroundColor: LiftFlowColors.accentGlow,
  },
  pressed: {
    opacity: 0.85,
  },
});
