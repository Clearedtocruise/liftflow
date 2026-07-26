import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { useUnits } from '@/hooks/useUnits';
import { formatWorkoutWeightForInput } from '@/lib/unitConversion';
import type { WorkoutSet } from '@/types';

type SetEditModalProps = {
  visible: boolean;
  set: WorkoutSet | null;
  exerciseName?: string;
  onSave: (setId: string, weight?: number, reps?: number) => Promise<void>;
  onDelete: (setId: string) => Promise<void>;
  onClose: () => void;
};

export function SetEditModal({ visible, set, exerciseName, onSave, onDelete, onClose }: SetEditModalProps) {
  const units = useUnits();
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (set) {
      setWeight(
        set.weight != null ? formatWorkoutWeightForInput(set.weight, units.preferredWeightUnit) : '',
      );
      setReps(set.reps != null ? String(set.reps) : '');
    }
  }, [set, units.preferredWeightUnit]);

  async function handleSave() {
    if (!set) return;
    setSaving(true);
    await onSave(
      set.id,
      weight ? units.parseWeight(weight) : undefined,
      reps ? parseInt(reps, 10) : undefined,
    );
    setSaving(false);
    onClose();
  }

  async function handleDelete() {
    if (!set) return;
    setSaving(true);
    await onDelete(set.id);
    setSaving(false);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <AppText variant="title">Edit Set {set?.setNumber}</AppText>
          {exerciseName ? (
            <AppText variant="footnote" color="textSecondary">
              {exerciseName}
            </AppText>
          ) : null}

          <View style={styles.inputRow}>
            <View style={styles.field}>
              <AppText variant="caption" color="textSecondary">
                Weight ({units.weightLabel})
              </AppText>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                value={weight}
                onChangeText={setWeight}
                placeholderTextColor={LiftFlowColors.textTertiary}
              />
            </View>
            <View style={styles.field}>
              <AppText variant="caption" color="textSecondary">
                Reps
              </AppText>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={reps}
                onChangeText={setReps}
                placeholderTextColor={LiftFlowColors.textTertiary}
              />
            </View>
          </View>

            <View style={styles.actions}>
              <PrimaryButton label="Save" onPress={handleSave} loading={saving} />
              <PrimaryButton label="Delete Set" onPress={handleDelete} variant="secondary" loading={saving} />
              <PrimaryButton label="Cancel" onPress={onClose} variant="secondary" />
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  sheet: {
    backgroundColor: LiftFlowColors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    gap: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.border,
  },
  inputRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  field: {
    flex: 1,
    gap: Spacing.xs,
  },
  input: {
    backgroundColor: LiftFlowColors.background,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    color: LiftFlowColors.textPrimary,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  actions: {
    gap: Spacing.sm,
  },
});
