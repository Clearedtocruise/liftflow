import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';

type WorkoutTabataToggleProps = {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
};

export function WorkoutTabataToggle({ enabled, onChange, disabled }: WorkoutTabataToggleProps) {
  return (
    <Pressable
      style={[styles.row, enabled && styles.rowActive]}
      onPress={() => !disabled && onChange(!enabled)}
      disabled={disabled}>
      <View style={styles.copy}>
        <AppText variant="bodyBold">Tabata mode</AppText>
        <AppText variant="caption" color="textSecondary">
          20s work · 20s rest · 10 rounds per exercise
        </AppText>
      </View>
      <Switch
        value={enabled}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: LiftFlowColors.border, true: LiftFlowColors.accent }}
        thumbColor={LiftFlowColors.textPrimary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    backgroundColor: LiftFlowColors.backgroundSecondary,
  },
  rowActive: {
    borderColor: LiftFlowColors.accent,
    backgroundColor: 'rgba(31, 107, 255, 0.1)',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
});
