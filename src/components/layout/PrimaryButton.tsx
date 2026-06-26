import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import type { AppTheme } from '@/constants/themes';
import { TouchTarget, Typography } from '@/constants/theme';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useThemedStyles } from '@/hooks/useLiftFlowTheme';

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

export function PrimaryButton(props: PrimaryButtonProps) {
  return <PrimaryActionButton {...props} />;
}

export function PrimaryActionButton({
  label,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  size = 'default',
  testID,
}: PrimaryButtonProps) {
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles);
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
              ? [theme.colors.surfaceHighlight, theme.colors.surfaceElevated]
              : [...theme.brandGradients.button]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.base, size === 'large' && styles.large, styles.primaryGradient, !isDisabled && theme.shadows.glow]}>
          {loading ? (
            <ActivityIndicator color={theme.colors.onPrimary} />
          ) : (
            <AppText variant="bodyBold" style={[styles.label, { color: theme.colors.onPrimary }]}>
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
        <ActivityIndicator color={theme.colors.primary} />
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

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    base: {
      minHeight: TouchTarget.comfortable,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.xxl,
    },
    large: {
      minHeight: TouchTarget.large,
      borderRadius: theme.radius.lg,
    },
    primaryGradient: {
      overflow: 'hidden',
    },
    secondary: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    ghost: {
      backgroundColor: 'transparent',
    },
    destructive: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(255, 91, 91, 0.45)' : 'rgba(239, 68, 68, 0.35)',
    },
    label: {
      ...Typography.bodyBold,
      letterSpacing: 0.3,
    },
    disabledWrap: {
      opacity: 0.5,
    },
  });
}
