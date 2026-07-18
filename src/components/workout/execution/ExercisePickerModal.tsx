import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { workoutService } from '@/services/workoutService';
import type { Exercise } from '@/types';

const MUSCLE_CHIPS = [
  'All',
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Legs',
  'Glutes',
  'Core',
  'Abs',
] as const;

type ExercisePickerModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
  title?: string;
};

function matchesMuscleChip(exercise: Exercise, chip: string): boolean {
  if (chip === 'All') return true;
  const haystack = [
    exercise.category,
    ...(exercise.muscleGroups ?? []),
    ...(exercise.secondaryMuscles ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const needle = chip.toLowerCase();
  if (needle === 'abs' || needle === 'core') {
    return haystack.includes('abs') || haystack.includes('core') || haystack.includes('oblique');
  }
  return haystack.includes(needle);
}

export function ExercisePickerModal({ visible, onClose, onSelect, title = 'Select Exercise' }: ExercisePickerModalProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [muscleChip, setMuscleChip] = useState<(typeof MUSCLE_CHIPS)[number]>('All');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [creatingCustom, setCreatingCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customMuscle, setCustomMuscle] = useState('general');
  const [customSaving, setCustomSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setMuscleChip('All');
    setCreatingCustom(false);
    setCustomName('');
  }, [visible]);

  async function handleCreateCustom() {
    if (!user || !customName.trim() || customSaving) return;
    setCustomSaving(true);
    const result = await workoutService.createCustomExercise(user.id, {
      name: customName.trim(),
      muscleGroup: customMuscle,
      equipment: 'other',
      exerciseType: 'strength',
    });
    setCustomSaving(false);
    if (!result.success) return;
    onSelect(result.data);
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

  const filtered = useMemo(
    () => exercises.filter((exercise) => matchesMuscleChip(exercise, muscleChip)),
    [exercises, muscleChip],
  );

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

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {MUSCLE_CHIPS.map((chip) => {
            const active = muscleChip === chip;
            return (
              <Pressable
                key={chip}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setMuscleChip(chip)}>
                <AppText variant="caption" color={active ? 'accent' : 'textSecondary'}>
                  {chip}
                </AppText>
              </Pressable>
            );
          })}
          {muscleChip !== 'All' ? (
            <Pressable style={styles.chip} onPress={() => setMuscleChip('All')}>
              <AppText variant="caption" color="textSecondary">
                Clear
              </AppText>
            </Pressable>
          ) : null}
        </ScrollView>

        <ScrollView contentContainerStyle={styles.list}>
          {loading ? (
            <AppText variant="body" color="textSecondary">
              Loading exercises…
            </AppText>
          ) : filtered.length === 0 ? (
            <AppText variant="body" color="textSecondary">
              No exercises found.
            </AppText>
          ) : (
            filtered.map((exercise) => (
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

        {creatingCustom ? (
          <View style={styles.customBox}>
            <TextInput
              style={styles.search}
              placeholder="Custom exercise name"
              placeholderTextColor={LiftFlowColors.textTertiary}
              value={customName}
              onChangeText={setCustomName}
              autoCapitalize="words"
            />
            <TextInput
              style={styles.search}
              placeholder="Primary muscle (e.g. abs)"
              placeholderTextColor={LiftFlowColors.textTertiary}
              value={customMuscle}
              onChangeText={setCustomMuscle}
              autoCapitalize="none"
            />
            <PrimaryButton
              label={customSaving ? 'Saving…' : 'Save custom exercise'}
              onPress={() => void handleCreateCustom()}
              disabled={!customName.trim() || customSaving}
            />
            <PrimaryButton label="Cancel create" variant="ghost" onPress={() => setCreatingCustom(false)} />
          </View>
        ) : (
          <PrimaryButton
            label="Create custom exercise"
            variant="secondary"
            onPress={() => {
              setCreatingCustom(true);
              setCustomName(query.trim());
            }}
          />
        )}

        <PrimaryButton label="Close" variant="ghost" onPress={onClose} />
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
  chips: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    backgroundColor: LiftFlowColors.surface,
  },
  chipActive: {
    borderColor: LiftFlowColors.accent,
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
  customBox: {
    gap: Spacing.sm,
  },
});
