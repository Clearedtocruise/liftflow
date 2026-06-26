import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';

import { LiftFlowLogo } from '@/components/brand/LiftFlowLogo';
import { Radius } from '@/constants/theme';

type LogoMarkProps = {
  size?: number;
  variant?: 'primary' | 'white' | 'black' | 'gradient';
  glow?: boolean;
  animate?: boolean;
  /** Tighter bounds when used inline (no glow halo). */
  compact?: boolean;
};

export function LogoMark({
  size = 64,
  variant = 'primary',
  glow = true,
  animate = false,
  compact = false,
}: LogoMarkProps) {
  const scale = useSharedValue(animate ? 0.88 : 1);
  const glowOpacity = useSharedValue(animate ? 0.4 : 0.85);

  useEffect(() => {
    if (!animate) return;

    scale.value = withSequence(
      withTiming(1.04, { duration: 680, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 420, easing: Easing.inOut(Easing.quad) }),
    );

    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.65, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, [animate, glowOpacity, scale]);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const outerGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const pad = compact ? 0 : Math.round(size * 0.42);

  return (
    <View style={[styles.wrap, { width: size + pad, height: size + pad }]}>
      {glow ? (
        <>
          <Animated.View style={[styles.outerGlow, outerGlowStyle, { borderRadius: (size + pad) / 2 }]}>
            <LinearGradient
              colors={['rgba(31, 107, 255, 0.5)', 'rgba(0, 229, 255, 0.18)', 'transparent']}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <LinearGradient
            colors={['rgba(31, 107, 255, 0.28)', 'rgba(0, 229, 255, 0.1)', 'transparent']}
            style={[styles.innerGlow, { borderRadius: Radius.full }]}
          />
        </>
      ) : null}
      <Animated.View style={logoStyle}>
        <LiftFlowLogo size={size} variant={variant} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerGlow: {
    ...StyleSheet.absoluteFillObject,
    transform: [{ scale: 1.35 }],
    overflow: 'hidden',
  },
  innerGlow: {
    ...StyleSheet.absoluteFillObject,
    transform: [{ scale: 1.12 }],
  },
});
