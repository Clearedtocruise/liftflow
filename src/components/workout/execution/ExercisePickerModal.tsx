import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { workoutService } from '@/services/workoutService';
import type { Exercise } from '@/types';

type ExercisePickerModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
  title?: string;
};

export function ExercisePickerModal({ visible, onClose, onSelect, title = 'Select Exercise' }: ExercisePickerModalProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !user) return;

    let cancelled = false;
    setLoading(true);
    void workoutService.searchExercises(query, user.id).then((result) => {
      if (cancelled) return;
      if (result.success) setExercises(result.data);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [visible, query, user]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <AppText variant="title">{title}</AppText>
          <Pressable onPress={onClose} hitSlop={12}>
            <AppText variant="bodyBold" color="accent">
              Close
            </AppText>
          </Pressable>
        </View>

        <TextInput
          style={styles.search}
          placeholder="Search exercises"
          placeholderTextColor={LiftFlowColors.textTertiary}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="words"
          autoCorrect={false}
        />

        <ScrollView contentContainerStyle={styles.list}>
          {loading ? (
            <AppText variant="body" color="textSecondary">
              Loading exercises…
            </AppText>
          ) : exercises.length === 0 ? (
            <AppText variant="body" color="textSecondary">
              No exercises found.
            </AppText>
          ) : (
            exercises.map((exercise) => (
              <Pressable
                key={exercise.id}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => {
                  onSelect(exercise);
                  onClose();
                }}>
                <AppText variant="bodyBold">{exercise.name}</AppText>
                <AppText variant="caption" color="textSecondary">
                  {exercise.equipment} · {exercise.category}
                </AppText>
              </Pressable>
            ))
          )}
        </ScrollView>

        <PrimaryButton label="Cancel" variant="secondary" onPress={onClose} />
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  search: {
    backgroundColor: LiftFlowColors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    color: LiftFlowColors.textPrimary,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  list: {
    gap: Spacing.sm,
    paddingBottom: Spacing.xxl,
  },
  row: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.surface,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    gap: Spacing.xs,
  },
  rowPressed: {
    backgroundColor: LiftFlowColors.surfaceHighlight,
  },
});
