import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type { AppTheme } from '@/constants/themes';
import { useThemedStyles } from '@/hooks/useLiftFlowTheme';

type SkeletonBlockProps = {
  height: number;
  width?: number | `${number}%`;
  style?: ViewStyle;
  animate?: boolean;
};

export function SkeletonBlock({ height, width = '100%', style, animate = true }: SkeletonBlockProps) {
  const styles = useThemedStyles(createStyles);
  const opacity = useSharedValue(0.45);

  useEffect(() => {
    if (!animate) return;
    opacity.value = withRepeat(
      withTiming(0.85, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [animate, opacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!animate) {
    return <View style={[styles.block, { height, width }, style]} />;
  }

  return <Animated.View style={[styles.block, pulseStyle, { height, width }, style]} />;
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    block: {
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
  });
}
