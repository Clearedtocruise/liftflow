import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { ExerciseGuideSheet } from '@/components/workout/execution/ExerciseGuideSheet';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import {
    shouldOfferCustomExercise,
    validateCustomExerciseName,
} from '@/lib/customExerciseName';
import { workoutService } from '@/services/workoutService';
import type { Exercise } from '@/types';

type ExercisePickerModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
  title?: string;
  /** The exercise being replaced. Kept out of the title so Close cannot be pushed off screen. */
  subtitle?: string;
};

export function ExercisePickerModal({
  visible,
  onClose,
  onSelect,
  title = 'Select Exercise',
  subtitle,
}: ExercisePickerModalProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Exercise | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const canCreate = !loading && shouldOfferCustomExercise(query, exercises);

  async function handleCreateCustom() {
    if (!user || creating) return;
    const check = validateCustomExerciseName(query);
    if (!check.valid) {
      setCreateError(check.reason);
      return;
    }

    setCreating(true);
    setCreateError(null);
    const result = await workoutService.createCustomExercise(check.name, user.id);
    setCreating(false);

    if (!result.success) {
      setCreateError(result.error);
      return;
    }
    onSelect(result.data);
    setQuery('');
    onClose();
  }

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
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <AppText variant="title" numberOfLines={2}>
              {title}
            </AppText>
            {subtitle ? (
              <AppText variant="caption" color="textSecondary" numberOfLines={1}>
                {subtitle}
              </AppText>
            ) : null}
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton}>
            <AppText variant="bodyBold" color="accent">
              Close
            </AppText>
          </Pressable>
        </View>

        <TextInput
          style={styles.search}
          placeholder="Search or name a new exercise"
          placeholderTextColor={LiftFlowColors.textTertiary}
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setCreateError(null);
          }}
          autoCapitalize="words"
          autoCorrect={false}
        />

        {/* The catalog is never complete — gym machines and coach variations are always missing. */}
        {canCreate ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add ${query.trim()} as a new exercise`}
            style={({ pressed }) => [styles.createRow, pressed && styles.rowPressed]}
            disabled={creating}
            onPress={() => void handleCreateCustom()}>
            <AppText variant="bodyBold" color="accent">
              {creating ? 'Adding…' : `Add "${query.trim()}"`}
            </AppText>
            <AppText variant="caption" color="textSecondary">
              Not in the catalog — save it to your own exercises
            </AppText>
          </Pressable>
        ) : null}

        {createError ? (
          <AppText variant="caption" color="error">
            {createError}
          </AppText>
        ) : null}

        {/* Without this the first tap only dismisses the keyboard, so choosing an exercise while
            typing silently did nothing. */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          {loading ? (
            <AppText variant="body" color="textSecondary">
              Loading exercises…
            </AppText>
          ) : exercises.length === 0 ? (
            <AppText variant="body" color="textSecondary">
              {query.trim()
                ? `No match for "${query.trim()}" — add it above to use it anyway.`
                : 'No exercises found.'}
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
                <View style={styles.rowMain}>
                  <View style={styles.rowText}>
                    <AppText variant="bodyBold">{exercise.name}</AppText>
                    <AppText variant="caption" color="textSecondary">
                      {exercise.equipment} · {exercise.category}
                    </AppText>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`How to do ${exercise.name}`}
                    hitSlop={12}
                    onPress={() => setPreview(exercise)}
                    style={styles.detailsButton}>
                    <AppText variant="caption" color="accent">
                      Details
                    </AppText>
                  </Pressable>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>

        <PrimaryButton label="Cancel" variant="secondary" onPress={onClose} />

        <ExerciseGuideSheet
          visible={preview != null}
          exercise={preview}
          onClose={() => setPreview(null)}
          onAddToWorkout={() => {
            if (!preview) return;
            const selected = preview;
            setPreview(null);
            onSelect(selected);
            onClose();
          }}
        />
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  closeButton: {
    // A long exercise name used to wrap the title and shove Close past the right edge.
    flexShrink: 0,
    paddingVertical: Spacing.xs,
  },
  scroll: {
    // Lets the list take the space between the search box and Cancel, so Cancel stays reachable
    // instead of being pushed under the keyboard.
    flex: 1,
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
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  rowText: {
    flex: 1,
    gap: Spacing.xs,
  },
  detailsButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  rowPressed: {
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
