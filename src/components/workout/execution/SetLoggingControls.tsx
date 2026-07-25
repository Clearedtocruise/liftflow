import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useUnits } from '@/hooks/useUnits';
import type { ExerciseLoggingMode } from '@/lib/exerciseModality';
import { formatWorkoutWeightForInput, parseDistanceToKm, parseWeightToKg, weightStepDisplay, adjustWeightKg } from '@/lib/unitConversion';

type SetLoggingControlsProps = {
  mode: ExerciseLoggingMode;
  weightKg: number;
  reps: number;
  durationSeconds: number;
  distanceKm: number;
  onChangeWeight: (weightKg: number) => void;
  onChangeReps: (reps: number) => void;
  onChangeDuration: (durationSeconds: number) => void;
  onChangeDistance: (distanceKm: number) => void;
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
  // The visible labels are display-cased ("WEIGHT (LB)"); screen readers get a spoken form, and
  // each stepper says what it changes instead of announcing a bare "minus 5".
  const spoken = label.toLowerCase();

  return (
    <View style={styles.field}>
      <AppText variant="caption" color="textSecondary">
        {label}
      </AppText>
      <View style={styles.stepper}>
        <Pressable
          style={({ pressed }) => [styles.stepButton, pressed && styles.stepButtonPressed]}
          onPress={onDecrease}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${spoken} by ${stepLabel}`}
          accessibilityState={{ disabled: Boolean(disabled) }}>
          <AppText variant="bodyBold">−{stepLabel}</AppText>
        </Pressable>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          editable={!disabled}
          selectTextOnFocus
          accessibilityLabel={spoken}
          accessibilityValue={{ text: value }}
        />
        <Pressable
          style={({ pressed }) => [styles.stepButton, pressed && styles.stepButtonPressed]}
          onPress={onIncrease}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${spoken} by ${stepLabel}`}
          accessibilityState={{ disabled: Boolean(disabled) }}>
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
  distanceKm,
  onChangeWeight,
  onChangeReps,
  onChangeDuration,
  onChangeDistance,
  disabled,
}: SetLoggingControlsProps) {
  const units = useUnits();
  const weightStepLabel = String(weightStepDisplay(units.preferredWeightUnit));
  const distanceUnitLabel = units.preferredDistanceUnit === 'km' ? 'km' : 'mi';
  const distanceStep = units.preferredDistanceUnit === 'km' ? 0.1 : 0.1;

  const [weightText, setWeightText] = useState(formatWorkoutWeightForInput(weightKg, units.preferredWeightUnit));
  const [repsText, setRepsText] = useState(String(reps));
  const [durationText, setDurationText] = useState(String(durationSeconds));
  const [distanceText, setDistanceText] = useState(String(Math.round(distanceKm * 100) / 100));

  useEffect(() => {
    setWeightText(formatWorkoutWeightForInput(weightKg, units.preferredWeightUnit));
  }, [weightKg, units.preferredWeightUnit]);

  useEffect(() => {
    setRepsText(String(reps));
  }, [reps]);

  useEffect(() => {
    setDurationText(String(durationSeconds));
  }, [durationSeconds]);

  useEffect(() => {
    setDistanceText(String(Math.round(distanceKm * 100) / 100));
  }, [distanceKm]);

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

  function handleDistanceText(text: string) {
    setDistanceText(text);
    const parsed = parseDistanceToKm(text, units.preferredDistanceUnit);
    if (parsed != null && !Number.isNaN(parsed)) onChangeDistance(Math.max(0, parsed));
  }

  if (mode === 'cardio') {
    return (
      <View style={styles.row}>
        <NumericField
          label="TIME (SEC)"
          value={durationText}
          onChangeText={handleDurationText}
          onDecrease={() => onChangeDuration(Math.max(1, durationSeconds - 15))}
          onIncrease={() => onChangeDuration(durationSeconds + 15)}
          stepLabel="15"
          disabled={disabled}
        />
        <NumericField
          label={`DISTANCE (${distanceUnitLabel})`}
          value={distanceText}
          onChangeText={handleDistanceText}
          onDecrease={() => onChangeDistance(Math.max(0, distanceKm - distanceStep))}
          onIncrease={() => onChangeDistance(distanceKm + distanceStep)}
          stepLabel={String(distanceStep)}
          disabled={disabled}
        />
      </View>
    );
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
        onDecrease={() => onChangeWeight(adjustWeightKg(weightKg, units.preferredWeightUnit, -1))}
        onIncrease={() => onChangeWeight(adjustWeightKg(weightKg, units.preferredWeightUnit, 1))}
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
