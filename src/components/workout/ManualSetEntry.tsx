import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { useUnits } from '@/hooks/useUnits';
import type { WorkoutExercise } from '@/types';

type ManualSetEntryProps = {
  exercises: WorkoutExercise[];
  onLogSet: (exerciseName: string, weight?: number, reps?: number) => Promise<boolean>;
  disabled?: boolean;
};

export function ManualSetEntry({ exercises, onLogSet, disabled }: ManualSetEntryProps) {
  const units = useUnits();
  const [exerciseName, setExerciseName] = useState('');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [logging, setLogging] = useState(false);

  async function handleLog() {
    const name = exerciseName.trim();
    if (!name) {
      Alert.alert('Exercise required', 'Enter or select an exercise.');
      return;
    }

    setLogging(true);
    const success = await onLogSet(
      name,
      weight ? units.parseWeight(weight) : undefined,
      reps ? parseInt(reps, 10) : undefined,
    );
    setLogging(false);

    if (success) {
      setWeight('');
      setReps('');
    }
  }

  return (
    <Card style={styles.card}>
      <AppText variant="subhead" color="textSecondary">
        Manual Log
      </AppText>

      <TextInput
        style={styles.input}
        placeholder="Exercise name"
        placeholderTextColor={LiftFlowColors.textTertiary}
        value={exerciseName}
        onChangeText={setExerciseName}
        editable={!disabled}
      />

      {exercises.length > 0 ? (
        <View style={styles.chipRow}>
          {exercises.map((exercise) => (
            <Pressable
              key={exercise.id}
              style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
              onPress={() => setExerciseName(exercise.exercise?.name ?? '')}>
              <AppText variant="caption">{exercise.exercise?.name ?? 'Exercise'}</AppText>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, styles.inputHalf]}
          placeholder={`Weight (${units.weightLabel})`}
          placeholderTextColor={LiftFlowColors.textTertiary}
          keyboardType="decimal-pad"
          value={weight}
          onChangeText={setWeight}
          editable={!disabled}
        />
        <TextInput
          style={[styles.input, styles.inputHalf]}
          placeholder="Reps"
          placeholderTextColor={LiftFlowColors.textTertiary}
          keyboardType="number-pad"
          value={reps}
          onChangeText={setReps}
          editable={!disabled}
        />
      </View>

      <PrimaryButton label="Log Set" onPress={handleLog} loading={logging} disabled={disabled} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  input: {
    backgroundColor: LiftFlowColors.background,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    color: LiftFlowColors.textPrimary,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  inputRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  inputHalf: {
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: LiftFlowColors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.border,
  },
  chipPressed: {
    backgroundColor: LiftFlowColors.surfaceHighlight,
  },
});
