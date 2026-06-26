import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { BrandGradients, LiftFlowColors, Radius, Spacing } from '@/constants/theme';

type GradientIntensity = keyof typeof BrandGradients.border;

type GradientBorderCardProps = {
  children: ReactNode;
  style?: ViewStyle;
  innerStyle?: StyleProp<ViewStyle>;
  intensity?: GradientIntensity;
};

/** ONE MORE signature gradient border — use for coach, hero, and insight surfaces. */
export function GradientBorderCard({
  children,
  style,
  innerStyle,
  intensity = 'default',
}: GradientBorderCardProps) {
  return (
    <View style={[styles.outer, style]}>
      <LinearGradient
        colors={[...BrandGradients.border[intensity]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.border}>
        <View style={[styles.inner, innerStyle]}>{children}</View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  border: {
    borderRadius: Radius.lg,
    padding: 1,
  },
  inner: {
    backgroundColor: LiftFlowColors.surface,
    borderRadius: Radius.lg - 1,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
});
