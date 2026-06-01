import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import type { PremiumGoalOption } from '@/constants/premiumGoals';
import { LiftFlowColors, Radius, Shadows, Spacing } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PremiumGoalCardProps = {
  goal: PremiumGoalOption;
  selected: boolean;
  rank?: number;
  onPress: () => void;
  disabled?: boolean;
};

export function PremiumGoalCard({ goal, selected, rank, onPress, disabled }: PremiumGoalCardProps) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const inner = (
    <>
      <Image source={{ uri: goal.image }} style={styles.image} contentFit="cover" />
      <LinearGradient colors={['transparent', 'rgba(8,11,16,0.92)']} style={styles.overlay} />
      {selected ? (
        <LinearGradient colors={['rgba(31, 107, 255, 0.35)', 'transparent']} style={styles.selectedGlow} />
      ) : null}
      <View style={styles.content}>
        <AppText variant="title" style={styles.icon}>
          {goal.icon}
        </AppText>
        <AppText variant="bodyBold">{goal.label}</AppText>
        <AppText variant="caption" color="textSecondary" numberOfLines={2}>
          {goal.description}
        </AppText>
      </View>
      {selected ? (
        <View style={styles.badge}>
          <AppText variant="caption" color="textPrimary">
            {rank != null ? `#${rank}` : '✓'}
          </AppText>
        </View>
      ) : null}
    </>
  );

  if (selected) {
    return (
      <Animated.View style={[styles.wrap, anim]}>
        <LinearGradient
          colors={[LiftFlowColors.primary, LiftFlowColors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBorder}>
          <AnimatedPressable
            disabled={disabled}
            onPress={onPress}
            onPressIn={() => {
              scale.value = withSpring(0.97, { damping: 15 });
            }}
            onPressOut={() => {
              scale.value = withSpring(1, { damping: 15 });
            }}
            style={[styles.card, styles.cardSelected]}>
            {inner}
          </AnimatedPressable>
        </LinearGradient>
      </Animated.View>
    );
  }

  return (
    <AnimatedPressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.97, { damping: 15 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15 });
      }}
      style={[styles.wrap, styles.card, anim]}>
      {inner}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '48%',
  },
  gradientBorder: {
    borderRadius: Radius.lg,
    padding: 1.5,
    ...Shadows.glow,
  },
  card: {
    height: 168,
    borderRadius: Radius.lg - 1,
    overflow: 'hidden',
    backgroundColor: LiftFlowColors.surface,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    ...Shadows.card,
  },
  cardSelected: {
    borderWidth: 0,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  selectedGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: Spacing.md,
    gap: 2,
  },
  icon: {
    fontSize: 20,
    lineHeight: 24,
  },
  badge: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: LiftFlowColors.primary,
    borderRadius: Radius.full,
    minWidth: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
});
