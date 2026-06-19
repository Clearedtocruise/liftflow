import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { SetLoggingControls } from '@/components/workout/execution/SetLoggingControls';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { getExerciseLoggingMode, getExerciseLoggingModeByName } from '@/lib/exerciseModality';
import type { WorkoutExercise } from '@/types';

export type ManualSetLogPayload = {
  exerciseName: string;
  weight?: number;
  reps?: number;
  durationSeconds?: number;
  distanceMeters?: number;
};

type ManualSetEntryProps = {
  exercises: WorkoutExercise[];
  onLogSet: (payload: ManualSetLogPayload) => Promise<boolean>;
  disabled?: boolean;
};

export function ManualSetEntry({ exercises, onLogSet, disabled }: ManualSetEntryProps) {
  const [exerciseName, setExerciseName] = useState('');
  const [weightKg, setWeightKg] = useState(0);
  const [reps, setReps] = useState(8);
  const [durationSeconds, setDurationSeconds] = useState(30);
  const [distanceKm, setDistanceKm] = useState(0);
  const [logging, setLogging] = useState(false);

  const selectedExercise = useMemo(
    () =>
      exercises.find(
        (item) => item.exercise?.name?.toLowerCase() === exerciseName.trim().toLowerCase(),
      ),
    [exercises, exerciseName],
  );

  const loggingMode = selectedExercise?.exercise
    ? getExerciseLoggingMode(
        selectedExercise.exercise,
        selectedExercise.suggestedReps,
        selectedExercise.exercise.name,
      )
    : exerciseName.trim()
      ? getExerciseLoggingModeByName(exerciseName.trim())
      : 'weighted';

  useEffect(() => {
    if (loggingMode === 'timed') {
      setReps(1);
      return;
    }
    if (loggingMode === 'cardio') {
      setReps(1);
      return;
    }
    if (loggingMode === 'bodyweight') {
      setWeightKg(0);
    }
  }, [loggingMode]);

  async function handleLog() {
    const name = exerciseName.trim();
    if (!name) {
      Alert.alert('Exercise required', 'Enter or select an exercise.');
      return;
    }

    setLogging(true);
    const success = await onLogSet({
      exerciseName: name,
      weight: loggingMode === 'weighted' ? weightKg : undefined,
      reps: loggingMode === 'weighted' || loggingMode === 'bodyweight' ? reps : undefined,
      durationSeconds: loggingMode === 'timed' || loggingMode === 'cardio' ? durationSeconds : undefined,
      distanceMeters: loggingMode === 'cardio' ? Math.round(distanceKm * 1000) : undefined,
    });
    setLogging(false);

    if (success) {
      if (loggingMode === 'weighted') {
        setReps(reps);
      } else if (loggingMode === 'bodyweight') {
        setReps(reps);
      }
    }
  }

  return (
    <Card style={styles.card}>
      <AppText variant="subhead" color="textSecondary">
        Quick log
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

      <SetLoggingControls
        mode={loggingMode}
        weightKg={weightKg}
        reps={reps}
        durationSeconds={durationSeconds}
        distanceKm={distanceKm}
        onChangeWeight={setWeightKg}
        onChangeReps={setReps}
        onChangeDuration={setDurationSeconds}
        onChangeDistance={setDistanceKm}
        disabled={disabled || logging}
      />

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
