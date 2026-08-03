import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { Gradients, LiftFlowColors, Radius, Shadows, Spacing, TouchTarget, Typography } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'default' | 'large';
  /** A short glyph set before the label. Decorative, so it stays out of the accessibility label. */
  icon?: string;
  testID?: string;
};

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  size = 'default',
  icon,
  testID,
}: PrimaryButtonProps) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const isDisabled = disabled || loading;

  if (variant === 'primary') {
    return (
      <AnimatedPressable
        testID={testID}
        onPress={onPress}
        disabled={isDisabled}
        onPressIn={() => {
          scale.value = withSpring(0.97, { damping: 15 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15 });
        }}
        style={[animStyle, isDisabled && styles.disabledWrap]}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: isDisabled }}>
        <LinearGradient
          colors={
            isDisabled
              ? [LiftFlowColors.surfaceHighlight, LiftFlowColors.surfaceElevated]
              : [...Gradients.action]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.base, size === 'large' && styles.large, styles.primaryGradient, !isDisabled && Shadows.glow]}>
          {loading ? (
            <ActivityIndicator color={LiftFlowColors.textPrimary} />
          ) : (
            <AppText variant="bodyBold" color="textPrimary" style={styles.label}>
              {icon ? `${icon}  ` : ''}
              {label}
            </AppText>
          )}
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      testID={testID}
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
        isDisabled && styles.disabledWrap,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}>
      {loading ? (
        <ActivityIndicator color={LiftFlowColors.primary} />
      ) : (
        <AppText
          variant="bodyBold"
          color={variant === 'ghost' ? 'primary' : 'textPrimary'}
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
  label: {
    ...Typography.bodyBold,
    letterSpacing: 0.3,
  },
  disabledWrap: {
    opacity: 0.5,
  },
});
