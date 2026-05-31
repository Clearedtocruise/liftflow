import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { angleLabel } from '@/lib/transformation/photoRoles';
import type { PhotoAngle } from '@/types/common';

const ANGLES: PhotoAngle[] = ['front', 'side_left', 'side_right', 'back'];

type PhotoAnglePickerProps = {
  value: PhotoAngle;
  onChange: (angle: PhotoAngle) => void;
};

export function PhotoAnglePicker({ value, onChange }: PhotoAnglePickerProps) {
  return (
    <View style={styles.wrap}>
      <AppText variant="caption" color="textSecondary">
        Photo angle
      </AppText>
      <View style={styles.row}>
        {ANGLES.map((angle) => (
          <Pressable
            key={angle}
            style={[styles.chip, value === angle && styles.chipActive]}
            onPress={() => onChange(angle)}>
            <AppText variant="caption">{angleLabel(angle)}</AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  chipActive: {
    borderColor: LiftFlowColors.accent,
    backgroundColor: LiftFlowColors.primaryMuted,
  },
});
