import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useUnits } from '@/hooks/useUnits';
import { formatWorkoutWeightForInput, weightStepKg } from '@/lib/unitConversion';

type SetLoggingControlsProps = {
  weightKg: number;
  reps: number;
  onChangeWeight: (weightKg: number) => void;
  onChangeReps: (reps: number) => void;
  disabled?: boolean;
};

function StepperField({
  label,
  value,
  onDecrease,
  onIncrease,
  disabled,
}: {
  label: string;
  value: string;
  onDecrease: () => void;
  onIncrease: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.field}>
      <AppText variant="caption" color="textSecondary">
        {label}
      </AppText>
      <View style={styles.stepper}>
        <Pressable
          style={({ pressed }) => [styles.stepButton, pressed && styles.stepButtonPressed]}
          onPress={onDecrease}
          disabled={disabled}>
          <AppText variant="title">−</AppText>
        </Pressable>
        <AppText variant="metric" style={styles.value}>
          {value}
        </AppText>
        <Pressable
          style={({ pressed }) => [styles.stepButton, pressed && styles.stepButtonPressed]}
          onPress={onIncrease}
          disabled={disabled}>
          <AppText variant="title">+</AppText>
        </Pressable>
      </View>
    </View>
  );
}

export function SetLoggingControls({
  weightKg,
  reps,
  onChangeWeight,
  onChangeReps,
  disabled,
}: SetLoggingControlsProps) {
  const units = useUnits();
  const step = weightStepKg(units.preferredWeightUnit);
  const displayWeight = formatWorkoutWeightForInput(weightKg, units.preferredWeightUnit);

  return (
    <View style={styles.row}>
      <StepperField
        label={`WEIGHT (${units.weightLabel})`}
        value={displayWeight}
        onDecrease={() => onChangeWeight(Math.max(0, weightKg - step))}
        onIncrease={() => onChangeWeight(weightKg + step)}
        disabled={disabled}
      />
      <StepperField
        label="REPS"
        value={String(reps)}
        onDecrease={() => onChangeReps(Math.max(0, reps - 1))}
        onIncrease={() => onChangeReps(reps + 1)}
        disabled={disabled}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  field: {
    flex: 1,
    gap: Spacing.sm,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: LiftFlowColors.backgroundSecondary,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    padding: Spacing.sm,
    minHeight: TouchTarget.large,
  },
  stepButton: {
    width: TouchTarget.min,
    height: TouchTarget.min,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LiftFlowColors.surfaceElevated,
  },
  stepButtonPressed: {
    backgroundColor: LiftFlowColors.surfaceHighlight,
  },
  value: {
    minWidth: 72,
    textAlign: 'center',
  },
});
