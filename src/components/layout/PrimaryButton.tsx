import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { BrandGradients, LiftFlowColors, Radius, Shadows, Spacing, TouchTarget, Typography } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'default' | 'large';
  testID?: string;
};

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  size = 'default',
  testID,
}: PrimaryButtonProps) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const isDisabled = disabled || loading;

  if (variant === 'primary') {
    return (
      <AnimatedPressable
        onPress={onPress}
        disabled={isDisabled}
        onPressIn={() => {
          scale.value = withSpring(0.97, { damping: 15 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15 });
        }}
        style={[animStyle, isDisabled && styles.disabledWrap]}
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled }}>
        <LinearGradient
          colors={
            isDisabled
              ? [LiftFlowColors.surfaceHighlight, LiftFlowColors.surfaceElevated]
              : [...BrandGradients.button]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.base, size === 'large' && styles.large, styles.primaryGradient, !isDisabled && Shadows.glow]}>
          {loading ? (
            <ActivityIndicator color={LiftFlowColors.textPrimary} />
          ) : (
            <AppText variant="bodyBold" color="textPrimary" style={styles.label}>
              {label}
            </AppText>
          )}
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={isDisabled}
      onPressIn={() => {
        scale.value = withSpring(0.97, { damping: 15 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15 });
      }}
      style={[
        animStyle,
        styles.base,
        size === 'large' && styles.large,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        variant === 'destructive' && styles.destructive,
        isDisabled && styles.disabledWrap,
      ]}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}>
      {loading ? (
        <ActivityIndicator color={LiftFlowColors.primary} />
      ) : (
        <AppText
          variant="bodyBold"
          color={
            variant === 'ghost'
              ? 'primary'
              : variant === 'destructive'
                ? 'error'
                : 'textPrimary'
          }
          style={styles.label}>
          {label}
        </AppText>
      )}
    </AnimatedPressable>
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
  primaryGradient: {
    overflow: 'hidden',
  },
  secondary: {
    backgroundColor: LiftFlowColors.surface,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  destructive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 91, 91, 0.45)',
  },
  label: {
    ...Typography.bodyBold,
    letterSpacing: 0.3,
  },
  disabledWrap: {
    opacity: 0.5,
  },
});
