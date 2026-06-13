import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import {
    exerciseAdvisoryService,
    type ExerciseAlternativeOption,
} from '@/services/exerciseAdvisoryService';
import type { EditableWorkoutExercise } from '@/types/workoutExecution';

type ExerciseReplaceSheetProps = {
  visible: boolean;
  exercise: EditableWorkoutExercise | null;
  userId?: string;
  goal?: string;
  programType?: string;
  availableEquipment?: string[];
  onClose: () => void;
  onReplace: (option: ExerciseAlternativeOption) => void;
  onManualSearch?: () => void;
};

export function ExerciseReplaceSheet({
  visible,
  exercise,
  userId,
  goal,
  programType,
  availableEquipment = [],
  onClose,
  onReplace,
  onManualSearch,
}: ExerciseReplaceSheetProps) {
  const [loading, setLoading] = useState(false);
  const [alternatives, setAlternatives] = useState<ExerciseAlternativeOption[]>([]);
  const [reasoning, setReasoning] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !exercise) return;

    let cancelled = false;
    setLoading(true);
    setAlternatives([]);
    setReasoning(null);

    void exerciseAdvisoryService
      .getExerciseAlternatives({
        userId: userId ?? '',
        exerciseName: exercise.name,
        muscleGroups: [],
        goal,
        programType,
        availableEquipment,
      })
      .then((result) => {
        if (cancelled) return;
        if (result.success) {
          setAlternatives(result.data.alternatives ?? []);
          setReasoning(result.data.reasoning);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, exercise, userId, goal, programType, availableEquipment]);

  if (!exercise) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <AppText variant="title">Replace Exercise</AppText>
        <AppText variant="bodyBold">{exercise.name}</AppText>
        <AppText variant="footnote" color="textSecondary">
          {exercise.sets} sets · {exercise.repRange ?? '8-10'} reps
          {exercise.supersetGroupId ? ` · ${exercise.supersetGroupId.replace('ss-', 'Superset ')}` : ''}
        </AppText>

        {reasoning ? (
          <AppText variant="footnote" color="textTertiary">
            {reasoning}
          </AppText>
        ) : null}

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={LiftFlowColors.accent} />
            <AppText variant="caption" color="textSecondary">
              Finding alternatives…
            </AppText>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {alternatives.map((option, index) => (
              <Pressable
                key={option.slug}
                style={styles.option}
                onPress={() => {
                  onReplace(option);
                  onClose();
                }}>
                <AppText variant="bodyBold">
                  {index + 1}. {option.name}
                </AppText>
                <AppText variant="caption" color="textSecondary">
                  {option.equipment} · {option.muscleGroups.slice(0, 2).join(', ')}
                </AppText>
                <AppText variant="caption" color="accent">
                  {option.reason}
                </AppText>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {onManualSearch ? (
          <Pressable onPress={onManualSearch}>
            <AppText variant="footnote" color="accent" align="center">
              Search manually instead
            </AppText>
          </Pressable>
        ) : null}

        <PrimaryButton label="Close" variant="secondary" onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LiftFlowColors.background,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  loading: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  list: {
    gap: Spacing.sm,
  },
  option: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.surface,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    gap: Spacing.xs,
  },
});
