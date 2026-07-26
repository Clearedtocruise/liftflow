import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { ExercisePickerModal } from '@/components/workout/execution/ExercisePickerModal';
import { ExerciseReplaceSheet } from '@/components/workout/execution/ExerciseReplaceSheet';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import type { ExerciseAlternativeOption } from '@/services/exerciseAdvisoryService';
import type { Exercise } from '@/types';
import type { EditableWorkoutExercise } from '@/types/workoutExecution';

type WorkoutEditScreenProps = {
  workoutName: string;
  exercises: EditableWorkoutExercise[];
  userId?: string;
  goal?: string;
  programType?: string;
  availableEquipment?: string[];
  /** Drives the Save affordance: without it, nothing on screen says edits are unsaved. */
  unsavedChanges?: boolean;
  saving?: boolean;
  saveError?: string | null;
  onChange: (exercises: EditableWorkoutExercise[]) => void;
  onDone: () => void | Promise<void>;
  onDiscard?: () => void;
};

function createExerciseId(name: string): string {
  return `custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
}

export function WorkoutEditScreen({
  workoutName,
  exercises,
  userId,
  goal,
  programType,
  availableEquipment,
  unsavedChanges = false,
  saving = false,
  saveError = null,
  onChange,
  onDone,
  onDiscard,
}: WorkoutEditScreenProps) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);

  function handleBack() {
    if (!unsavedChanges) {
      router.back();
      return;
    }
    // Leaving used to drop the edits without saying so, which is the whole complaint.
    Alert.alert('Unsaved changes', 'Save your changes to this workout before leaving?', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => (onDiscard ? onDiscard() : router.back()) },
      { text: 'Save', onPress: () => void onDone() },
    ]);
  }

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
      restSeconds: 90,
    };

    if (replaceIndex != null) {
      updateAt(replaceIndex, { ...next, sets: exercises[replaceIndex]?.sets ?? 3, repRange: exercises[replaceIndex]?.repRange });
      setReplaceIndex(null);
      return;
    }

    onChange([...exercises, next]);
  }

  function handleReplaceWithAlternative(option: ExerciseAlternativeOption) {
    if (replaceIndex == null) return;
    updateAt(replaceIndex, {
      ...exercises[replaceIndex],
      id: createExerciseId(option.name),
      name: option.name,
    });
    setReplaceIndex(null);
  }

  return (
    <ScreenContainer contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" onPress={handleBack} style={styles.back}>
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
            {exercise.sets} sets{exercise.repRange ? ` · ${exercise.repRange}` : ''}{exercise.restSeconds ? ` · Rest ${exercise.restSeconds}s` : ''}
          </AppText>
          <View style={styles.restRow}>
            <Pressable onPress={() => updateAt(index, { ...exercise, restSeconds: Math.max(30, (exercise.restSeconds ?? 90) - 15) })}>
              <AppText variant="caption" color="textSecondary">Rest −15s</AppText>
            </Pressable>
            <Pressable onPress={() => updateAt(index, { ...exercise, restSeconds: (exercise.restSeconds ?? 90) + 15 })}>
              <AppText variant="caption" color="textSecondary">Rest +15s</AppText>
            </Pressable>
          </View>
          <View style={styles.actions}>
            <Pressable onPress={() => setReplaceIndex(index)}>
              <AppText variant="footnote" color="accent">Replace Exercise</AppText>
            </Pressable>
            <Pressable onPress={() => removeAt(index)}>
              <AppText variant="footnote" color="textSecondary">Remove</AppText>
            </Pressable>
            <Pressable onPress={() => moveAt(index, -1)} disabled={index === 0}>
              <AppText variant="footnote" color={index === 0 ? 'textTertiary' : 'textSecondary'}>Move up</AppText>
            </Pressable>
            <Pressable onPress={() => moveAt(index, 1)} disabled={index === exercises.length - 1}>
              <AppText variant="footnote" color={index === exercises.length - 1 ? 'textTertiary' : 'textSecondary'}>Move down</AppText>
            </Pressable>
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

      {saveError ? (
        <AppText variant="footnote" color="error" align="center">
          {saveError}
        </AppText>
      ) : unsavedChanges ? (
        <AppText variant="footnote" color="textSecondary" align="center">
          Unsaved changes
        </AppText>
      ) : null}

      <PrimaryButton
        label={unsavedChanges ? 'Save Changes' : 'Done'}
        onPress={() => void onDone()}
        loading={saving}
        disabled={saving}
        size="large"
      />

      {unsavedChanges && onDiscard ? (
        <PrimaryButton
          label="Discard Changes"
          variant="secondary"
          onPress={onDiscard}
          disabled={saving}
        />
      ) : null}

      <ExerciseReplaceSheet
        visible={replaceIndex != null}
        exercise={replaceIndex != null ? exercises[replaceIndex] ?? null : null}
        userId={userId}
        goal={goal}
        programType={programType}
        availableEquipment={availableEquipment}
        onClose={() => setReplaceIndex(null)}
        onReplace={handleReplaceWithAlternative}
        onManualSearch={() => {
          setPickerVisible(true);
        }}
      />

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
    gap: Spacing.lg,
    marginTop: Spacing.sm,
  },
  restRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
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
