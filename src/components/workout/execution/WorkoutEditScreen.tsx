import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { ExercisePickerModal } from '@/components/workout/execution/ExercisePickerModal';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import type { Exercise } from '@/types';
import type { EditableWorkoutExercise } from '@/types/workoutExecution';

type WorkoutEditScreenProps = {
  workoutName: string;
  exercises: EditableWorkoutExercise[];
  onChange: (exercises: EditableWorkoutExercise[]) => void;
  onDone: () => void;
};

function createExerciseId(name: string): string {
  return `custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
}

export function WorkoutEditScreen({ workoutName, exercises, onChange, onDone }: WorkoutEditScreenProps) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);

  function updateAt(index: number, next: EditableWorkoutExercise) {
    const copy = [...exercises];
    copy[index] = next;
    onChange(copy);
  }

  function removeAt(index: number) {
    onChange(exercises.filter((_, i) => i !== index));
  }

  function moveAt(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= exercises.length) return;
    const copy = [...exercises];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    onChange(copy);
  }

  function handleSelectExercise(exercise: Exercise) {
    const next: EditableWorkoutExercise = {
      id: createExerciseId(exercise.name),
      name: exercise.name,
      sets: 3,
      repRange: '8-10',
    };

    if (replaceIndex != null) {
      updateAt(replaceIndex, { ...next, sets: exercises[replaceIndex]?.sets ?? 3, repRange: exercises[replaceIndex]?.repRange });
      setReplaceIndex(null);
      return;
    }

    onChange([...exercises, next]);
  }

  return (
    <ScreenContainer contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <AppText variant="bodyBold" color="accent">
          Back
        </AppText>
      </Pressable>
      <AppText variant="title">Edit Workout</AppText>
      <AppText variant="footnote" color="textSecondary">
        {workoutName}
      </AppText>

      {exercises.map((exercise, index) => (
        <Card key={exercise.id} style={styles.row}>
          <AppText variant="bodyBold">{exercise.name}</AppText>
          <AppText variant="caption" color="textSecondary">
            {exercise.sets} sets{exercise.repRange ? ` · ${exercise.repRange}` : ''}
          </AppText>
          <View style={styles.actions}>
            <ActionChip label="Replace" onPress={() => { setReplaceIndex(index); setPickerVisible(true); }} />
            <ActionChip label="Remove" onPress={() => removeAt(index)} />
            <ActionChip label="Move Up" onPress={() => moveAt(index, -1)} disabled={index === 0} />
            <ActionChip label="Move Down" onPress={() => moveAt(index, 1)} disabled={index === exercises.length - 1} />
          </View>
        </Card>
      ))}

      <Pressable style={styles.addCard} onPress={() => { setReplaceIndex(null); setPickerVisible(true); }}>
        <AppText variant="bodyBold" color="accent">
          + Add Exercise
        </AppText>
      </Pressable>

      <AppText variant="caption" color="textTertiary" align="center">
        Changes apply to this workout only
      </AppText>

      <PrimaryButton label="Done" onPress={onDone} size="large" />

      <ExercisePickerModal
        visible={pickerVisible}
        onClose={() => {
          setPickerVisible(false);
          setReplaceIndex(null);
        }}
        onSelect={handleSelectExercise}
        title={replaceIndex != null ? 'Replace Exercise' : 'Add Exercise'}
      />
    </ScreenContainer>
  );
}

function ActionChip({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.chip, disabled && styles.chipDisabled, pressed && !disabled && styles.chipPressed]}
      onPress={onPress}
      disabled={disabled}>
      <AppText variant="caption" color={disabled ? 'textTertiary' : 'textPrimary'}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.md,
    paddingBottom: Spacing.huge,
  },
  back: {
    alignSelf: 'flex-start',
  },
  row: {
    gap: Spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: LiftFlowColors.surfaceElevated,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  chipPressed: {
    backgroundColor: LiftFlowColors.surfaceHighlight,
  },
  chipDisabled: {
    opacity: 0.45,
  },
  addCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: LiftFlowColors.border,
    backgroundColor: LiftFlowColors.backgroundSecondary,
  },
});
