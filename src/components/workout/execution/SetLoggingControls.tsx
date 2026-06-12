import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useUnits } from '@/hooks/useUnits';
import type { ExerciseLoggingMode } from '@/lib/exerciseModality';
import { formatWorkoutWeightForInput, parseWeightToKg, weightStepDisplay, weightStepKg } from '@/lib/unitConversion';

type SetLoggingControlsProps = {
  mode: ExerciseLoggingMode;
  weightKg: number;
  reps: number;
  durationSeconds: number;
  onChangeWeight: (weightKg: number) => void;
  onChangeReps: (reps: number) => void;
  onChangeDuration: (durationSeconds: number) => void;
  disabled?: boolean;
};

type NumericFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onDecrease: () => void;
  onIncrease: () => void;
  stepLabel: string;
  disabled?: boolean;
};

function NumericField({ label, value, onChangeText, onDecrease, onIncrease, stepLabel, disabled }: NumericFieldProps) {
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
          <AppText variant="bodyBold">−{stepLabel}</AppText>
        </Pressable>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType="number-pad"
          editable={!disabled}
          selectTextOnFocus
        />
        <Pressable
          style={({ pressed }) => [styles.stepButton, pressed && styles.stepButtonPressed]}
          onPress={onIncrease}
          disabled={disabled}>
          <AppText variant="bodyBold">+{stepLabel}</AppText>
        </Pressable>
      </View>
    </View>
  );
}

export function SetLoggingControls({
  mode,
  weightKg,
  reps,
  durationSeconds,
  onChangeWeight,
  onChangeReps,
  onChangeDuration,
  disabled,
}: SetLoggingControlsProps) {
  const units = useUnits();
  const weightStepKgValue = weightStepKg(units.preferredWeightUnit);
  const weightStepLabel = String(weightStepDisplay(units.preferredWeightUnit));

  const [weightText, setWeightText] = useState(formatWorkoutWeightForInput(weightKg, units.preferredWeightUnit));
  const [repsText, setRepsText] = useState(String(reps));
  const [durationText, setDurationText] = useState(String(durationSeconds));

  useEffect(() => {
    setWeightText(formatWorkoutWeightForInput(weightKg, units.preferredWeightUnit));
  }, [weightKg, units.preferredWeightUnit]);

  useEffect(() => {
    setRepsText(String(reps));
  }, [reps]);

  useEffect(() => {
    setDurationText(String(durationSeconds));
  }, [durationSeconds]);

  function handleWeightText(text: string) {
    setWeightText(text);
    const parsed = parseWeightToKg(text, units.preferredWeightUnit);
    if (parsed != null && !Number.isNaN(parsed)) onChangeWeight(Math.max(0, parsed));
  }

  function handleRepsText(text: string) {
    setRepsText(text);
    const parsed = Number.parseInt(text, 10);
    if (!Number.isNaN(parsed)) onChangeReps(Math.max(0, parsed));
  }

  function handleDurationText(text: string) {
    setDurationText(text);
    const parsed = Number.parseInt(text, 10);
    if (!Number.isNaN(parsed)) onChangeDuration(Math.max(1, parsed));
  }

  if (mode === 'timed') {
    return (
      <NumericField
        label="DURATION (SEC)"
        value={durationText}
        onChangeText={handleDurationText}
        onDecrease={() => onChangeDuration(Math.max(1, durationSeconds - 5))}
        onIncrease={() => onChangeDuration(durationSeconds + 5)}
        stepLabel="5"
        disabled={disabled}
      />
    );
  }

  if (mode === 'bodyweight') {
    return (
      <NumericField
        label="REPS"
        value={repsText}
        onChangeText={handleRepsText}
        onDecrease={() => onChangeReps(Math.max(0, reps - 1))}
        onIncrease={() => onChangeReps(reps + 1)}
        stepLabel="1"
        disabled={disabled}
      />
    );
  }

  return (
    <View style={styles.row}>
      <NumericField
        label={`WEIGHT (${units.weightLabel})`}
        value={weightText}
        onChangeText={handleWeightText}
        onDecrease={() => onChangeWeight(Math.max(0, weightKg - weightStepKgValue))}
        onIncrease={() => onChangeWeight(weightKg + weightStepKgValue)}
        stepLabel={weightStepLabel}
        disabled={disabled}
      />
      <NumericField
        label="REPS"
        value={repsText}
        onChangeText={handleRepsText}
        onDecrease={() => onChangeReps(Math.max(0, reps - 1))}
        onIncrease={() => onChangeReps(reps + 1)}
        stepLabel="1"
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
    gap: Spacing.xs,
  },
  stepButton: {
    minWidth: TouchTarget.min,
    height: TouchTarget.min,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LiftFlowColors.surfaceElevated,
    paddingHorizontal: Spacing.xs,
  },
  stepButtonPressed: {
    backgroundColor: LiftFlowColors.surfaceHighlight,
  },
  input: {
    flex: 1,
    minWidth: 48,
    textAlign: 'center',
    color: LiftFlowColors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    paddingVertical: Spacing.xs,
  },
});
