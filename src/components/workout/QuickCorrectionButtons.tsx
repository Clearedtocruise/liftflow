import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { QUICK_CORRECTIONS } from '@/constants/workout';

type QuickCorrectionButtonsProps = {
  onPress?: (id: string) => void;
};

export function QuickCorrectionButtons({ onPress }: QuickCorrectionButtonsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}>
      {QUICK_CORRECTIONS.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => onPress?.(item.id)}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={item.label}>
          <AppText variant="subhead">{item.label}</AppText>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  button: {
    minHeight: TouchTarget.min,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    backgroundColor: LiftFlowColors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    backgroundColor: LiftFlowColors.surfaceHighlight,
    transform: [{ scale: 0.97 }],
  },
});
