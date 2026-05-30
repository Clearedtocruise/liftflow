import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing, TouchTarget } from '@/constants/theme';

type SelectableChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

export function SelectableChip({ label, selected, onPress }: SelectableChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.chipPressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}>
      <AppText variant="body" color={selected ? 'background' : 'textPrimary'}>
        {label}
      </AppText>
    </Pressable>
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
    minHeight: TouchTarget.min,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.border,
    backgroundColor: LiftFlowColors.surfaceElevated,
  },
  chipSelected: {
    backgroundColor: LiftFlowColors.accent,
    borderColor: LiftFlowColors.accent,
  },
  chipPressed: {
    opacity: 0.9,
  },
});
