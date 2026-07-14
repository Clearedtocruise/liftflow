import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Shadows, Spacing, TouchTarget } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type SelectableChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: string;
  disabled?: boolean;
};

export function SelectableChip({ label, selected, onPress, icon, disabled }: SelectableChipProps) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => {
        if (disabled) return;
        scale.value = withSpring(0.96, { damping: 15 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15 });
      }}
      style={[
        styles.chip,
        selected && styles.chipSelected,
        disabled && styles.chipDisabled,
        anim,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: Boolean(disabled) }}>
      {icon ? (
        <AppText variant="body" style={styles.icon}>
          {icon}
        </AppText>
      ) : null}
      <AppText variant="body" color={selected ? 'textPrimary' : 'textPrimary'} style={selected ? styles.selectedText : undefined}>
        {label}
      </AppText>
    </AnimatedPressable>
  );
}

export function ChipGrid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: TouchTarget.min,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    backgroundColor: LiftFlowColors.surfaceElevated,
  },
  chipSelected: {
    backgroundColor: LiftFlowColors.primary,
    borderColor: LiftFlowColors.primary,
    ...Shadows.glow,
  },
  chipDisabled: {
    opacity: 0.45,
  },
  selectedText: {
    fontWeight: '600',
  },
  icon: {
    fontSize: 16,
  },
});
