import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { useExerciseSearch } from '@/hooks/useExerciseSearch';
import { exerciseToAlternativeOption } from '@/lib/exerciseReplaceOption';
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
}: ExerciseReplaceSheetProps) {
  const [loading, setLoading] = useState(false);
  const [alternatives, setAlternatives] = useState<ExerciseAlternativeOption[]>([]);
  const [reasoning, setReasoning] = useState<string | null>(null);
  /**
   * Manual search lives inside this sheet. It used to hand off to the picker modal / the edit
   * screen, and because this sheet stayed open on top, that landed behind it and looked dead.
   */
  const [searching, setSearching] = useState(false);
  const search = useExerciseSearch({ enabled: visible && searching, userId });
  const resetSearch = search.reset;

  useEffect(() => {
    if (visible) return;
    setSearching(false);
    resetSearch();
  }, [visible, resetSearch]);

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

  function choose(option: ExerciseAlternativeOption) {
    onReplace(option);
    onClose();
  }

  async function handleCreateCustom() {
    const created = await search.createCustom();
    if (!created) return;
    choose(exerciseToAlternativeOption(created));
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <AppText variant="title">Replace Exercise</AppText>
        <AppText variant="bodyBold">{exercise.name}</AppText>
        <AppText variant="footnote" color="textSecondary">
          {exercise.sets} sets · {exercise.repRange ?? '8-10'} reps
          {exercise.supersetGroupId ? ` · ${exercise.supersetGroupId.replace('ss-', 'Superset ')}` : ''}
        </AppText>

        {searching ? (
          <>
            <TextInput
              style={styles.search}
              placeholder="Search or name a new exercise"
              placeholderTextColor={LiftFlowColors.textTertiary}
              value={search.query}
              onChangeText={search.setQuery}
              autoCapitalize="words"
              autoCorrect={false}
              autoFocus
            />

            {search.canCreate ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Use ${search.query.trim()} as a new exercise`}
                style={({ pressed }) => [styles.createRow, pressed && styles.optionPressed]}
                disabled={search.creating}
                onPress={() => void handleCreateCustom()}>
                <AppText variant="bodyBold" color="accent">
                  {search.creating ? 'Adding…' : `Use "${search.query.trim()}"`}
                </AppText>
                <AppText variant="caption" color="textSecondary">
                  Not in the catalog — save it to your own exercises
                </AppText>
              </Pressable>
            ) : null}

            {search.createError ? (
              <AppText variant="caption" color="error">
                {search.createError}
              </AppText>
            ) : null}

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag">
              {search.loading ? (
                <AppText variant="body" color="textSecondary">
                  Searching…
                </AppText>
              ) : search.exercises.length === 0 ? (
                <AppText variant="body" color="textSecondary">
                  {search.query.trim()
                    ? `No match for "${search.query.trim()}" — add it above to use it anyway.`
                    : 'No exercises found.'}
                </AppText>
              ) : (
                search.exercises.map((option) => (
                  <Pressable
                    key={option.id}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                    onPress={() => choose(exerciseToAlternativeOption(option))}>
                    <AppText variant="bodyBold">{option.name}</AppText>
                    <AppText variant="caption" color="textSecondary">
                      {option.equipment} · {option.category}
                    </AppText>
                  </Pressable>
                ))
              )}
            </ScrollView>

            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                setSearching(false);
                search.reset();
              }}>
              <AppText variant="footnote" color="accent" align="center">
                Back to suggestions
              </AppText>
            </Pressable>
          </>
        ) : (
          <>
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
              <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
                {alternatives.map((option, index) => (
                  <Pressable
                    key={option.slug}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                    onPress={() => choose(option)}>
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

            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setSearching(true)}>
              <AppText variant="footnote" color="accent" align="center">
                Search for a different exercise
              </AppText>
            </Pressable>
          </>
        )}

        <PrimaryButton label="Close" variant="secondary" onPress={onClose} />
      </KeyboardAvoidingView>
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
  scroll: {
    // Keeps Close reachable instead of letting a long list push it under the keyboard.
    flex: 1,
  },
  list: {
    gap: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  search: {
    backgroundColor: LiftFlowColors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    color: LiftFlowColors.textPrimary,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  option: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.surface,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    gap: Spacing.xs,
  },
  optionPressed: {
    backgroundColor: LiftFlowColors.surfaceHighlight,
  },
  createRow: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: LiftFlowColors.accent,
    backgroundColor: LiftFlowColors.surface,
    gap: Spacing.xs,
  },
});
