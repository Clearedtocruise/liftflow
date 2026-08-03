import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { LiftFlowColors } from '@/constants/theme';

type Particle = {
  id: string;
  color: string;
  startX: number;
  driftX: number;
  peakY: number;
  size: number;
  delay: number;
  duration: number;
};

const PALETTE = [
  LiftFlowColors.success,
  LiftFlowColors.primary,
  LiftFlowColors.restTimer,
  LiftFlowColors.warning,
  '#9B7BFF',
  '#FF8A4C',
];

function buildParticles(seed: string): Particle[] {
  // Deterministic enough for a given workout name so remounts do not reshuffle mid-animation.
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;

  return Array.from({ length: 18 }, (_, index) => {
    hash = (hash * 1664525 + 1013904223) >>> 0;
    const lane = (hash % 1000) / 1000;
    hash = (hash * 1664525 + 1013904223) >>> 0;
    const height = 0.35 + ((hash % 1000) / 1000) * 0.45;
    hash = (hash * 1664525 + 1013904223) >>> 0;
    const drift = ((hash % 1000) / 1000 - 0.5) * 120;
    hash = (hash * 1664525 + 1013904223) >>> 0;
    return {
      id: `${seed}-${index}`,
      color: PALETTE[index % PALETTE.length],
      startX: 8 + lane * 84,
      driftX: drift,
      peakY: height,
      size: 4 + (index % 4),
      delay: (index % 6) * 70,
      duration: 1100 + (index % 5) * 120,
    };
  });
}

function BurstParticle({ particle }: { particle: Particle }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      particle.delay,
      withSequence(
        withTiming(1, { duration: particle.duration, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 80 }),
      ),
    );
  }, [particle.delay, particle.duration, progress]);

  const style = useAnimatedStyle(() => {
    const t = progress.value;
    const y = -particle.peakY * 180 * t + 40 * t * t;
    const x = particle.driftX * t;
    const opacity = t < 0.15 ? t / 0.15 : Math.max(0, 1 - (t - 0.15) / 0.85);
    const scale = 0.6 + t * 0.8;
    return {
      opacity,
      transform: [
        { translateX: x },
        { translateY: y },
        { scale },
        { rotate: `${t * 180}deg` },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        {
          left: `${particle.startX}%`,
          width: particle.size,
          height: particle.size,
          borderRadius: particle.size / 2,
          backgroundColor: particle.color,
        },
        style,
      ]}
    />
  );
}

type CelebrationBurstProps = {
  /** Stable seed so remounts keep the same burst pattern. */
  seed: string;
};

/** Lightweight fireworks for the completed-workout home hero — no third-party confetti package. */
export function CelebrationBurst({ seed }: CelebrationBurstProps) {
  const particles = buildParticles(seed || 'done');
  return (
    <View pointerEvents="none" style={styles.stage}>
      {particles.map((particle) => (
        <BurstParticle key={particle.id} particle={particle} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  particle: {
    position: 'absolute',
    bottom: '18%',
  },
});
