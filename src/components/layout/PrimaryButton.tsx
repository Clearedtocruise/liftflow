import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing, TouchTarget, Typography } from '@/constants/theme';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'default' | 'large';
};

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  size = 'default',
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        size === 'large' && styles.large,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? LiftFlowColors.background : LiftFlowColors.accent} />
      ) : (
        <AppText
          variant="bodyBold"
          color={variant === 'primary' ? 'background' : variant === 'ghost' ? 'accent' : 'textPrimary'}
          style={styles.label}>
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TouchTarget.comfortable,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  large: {
    minHeight: TouchTarget.large,
    borderRadius: Radius.lg,
  },
  primary: {
    backgroundColor: LiftFlowColors.accent,
  },
  secondary: {
    backgroundColor: LiftFlowColors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  label: {
    ...Typography.bodyBold,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.45,
  },
});
