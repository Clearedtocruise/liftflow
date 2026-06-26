import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';

import { LiftFlowColors, Radius } from '@/constants/theme';

type SkeletonBlockProps = {
  height: number;
  width?: number | `${number}%`;
  style?: ViewStyle;
  animate?: boolean;
};

export function SkeletonBlock({ height, width = '100%', style, animate = true }: SkeletonBlockProps) {
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

  return (
    <Animated.View style={[styles.block, pulseStyle, { height, width }, style]} />
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: LiftFlowColors.backgroundSecondary,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
});
