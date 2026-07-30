import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { useUnits } from '@/hooks/useUnits';
import { formatWorkoutWeightForInput } from '@/lib/unitConversion';
import { intentLabel } from '@/lib/voice';
import type { ParsedVoiceCommandExtended } from '@/types/voice';

export type ConfirmedVoiceSet = {
  exercise: string;
  /** Already converted out of the display unit — the logging path stores kilograms. */
  weightKg?: number;
  reps?: number;
};

type VoiceConfirmModalProps = {
  visible: boolean;
  parsed: ParsedVoiceCommandExtended | null;
  transcript: string;
  /** Parsed weight normalized to kg; the inputs render it in the user's preferred unit. */
  weightKg?: number;
  /** Exercise currently on screen — used when the transcript omits the lift name. */
  activeExerciseName?: string;
  /** Why confirmation was required (low confidence, implausible value) — shown as a warning. */
  reason?: string;
  /** Save failure from the last attempt (shown in-sheet so it is not hidden behind the modal). */
  saveError?: string | null;
  saving?: boolean;
  onConfirm: (set: ConfirmedVoiceSet) => void | Promise<void>;
  onReject: () => void;
};

/** Strip unit words so a bad parse never leaves "95 pounds" in the weight box. */
function sanitizeWeightInput(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, '');
  if (!cleaned) return '';
  const parts = cleaned.split('.');
  if (parts.length === 1) return parts[0];
  return `${parts[0]}.${parts.slice(1).join('')}`;
}

function looksLikeWeightPhrase(value: string): boolean {
  return /^\d+(?:\.\d+)?\s*(?:lbs?|pounds?|kg|kilos?)?$/i.test(value.trim());
}

export function VoiceConfirmModal({
  visible,
  parsed,
  transcript,
  weightKg,
  activeExerciseName,
  reason,
  saveError,
  saving,
  onConfirm,
  onReject,
}: VoiceConfirmModalProps) {
  const units = useUnits();
  const [exercise, setExercise] = useState('');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');

  // Reseed whenever a new parse opens the sheet, so an edit from a previous attempt is not reused.
  useEffect(() => {
    if (!visible) return;
    const spokenExercise = parsed?.exercise?.trim() ?? '';
    const fallbackExercise = activeExerciseName?.trim() ?? '';
    // A mis-parse that stuffed "95 pounds" into the exercise field must not block Save.
    const seededExercise =
      spokenExercise && !looksLikeWeightPhrase(spokenExercise) ? spokenExercise : fallbackExercise;
    setExercise(seededExercise);
    setWeight(formatWorkoutWeightForInput(weightKg, units.preferredWeightUnit));
    setReps(parsed?.reps != null ? String(parsed.reps) : '');
  }, [visible, parsed, weightKg, units.preferredWeightUnit, activeExerciseName]);

  const isSetIntent = !parsed?.intent || parsed.intent === 'log_set';
  const resolvedExercise = exercise.trim() || activeExerciseName?.trim() || '';
  const canSave = isSetIntent && resolvedExercise.length > 0 && reps.trim().length > 0;

  function handleConfirm() {
    if (!canSave || saving) return;
    const weightText = sanitizeWeightInput(weight);
    void onConfirm({
      exercise: resolvedExercise,
      weightKg: weightText ? units.parseWeight(weightText) : undefined,
      reps: reps.trim() ? parseInt(reps, 10) : undefined,
    });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onReject}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <AppText variant="title">Confirm Set</AppText>
          <AppText variant="body" color="textSecondary" style={styles.transcript}>
            &quot;{transcript}&quot;
          </AppText>

          {reason ? (
            <AppText variant="caption" color="warning">
              {reason}
            </AppText>
          ) : null}

          {saveError ? (
            <AppText variant="caption" color="error">
              {saveError}
            </AppText>
          ) : null}

          {parsed && !isSetIntent ? (
            <View style={styles.parsed}>
              <AppText variant="caption" color="textSecondary">
                {intentLabel(parsed.intent)}
              </AppText>
              <AppText variant="bodyBold">{parsed.exercise ?? '—'}</AppText>
              {parsed.targetWeight != null ? (
                <AppText variant="metric" color="accent">
                  Target {parsed.targetWeight} {parsed.weightUnit ?? 'lb'}
                </AppText>
              ) : null}
              <AppText variant="caption" color="textSecondary" align="center">
                Only set logging can be saved from here.
              </AppText>
            </View>
          ) : (
            <>
              <View style={styles.field}>
                <AppText variant="caption" color="textSecondary">
                  Exercise
                </AppText>
                <TextInput
                  style={styles.input}
                  value={exercise}
                  onChangeText={setExercise}
                  autoCapitalize="words"
                  placeholder={activeExerciseName || 'Bench Press'}
                  placeholderTextColor={LiftFlowColors.textTertiary}
                />
              </View>

              <View style={styles.inputRow}>
                <View style={styles.field}>
                  <AppText variant="caption" color="textSecondary">
                    Weight ({units.weightLabel})
                  </AppText>
                  <TextInput
                    style={styles.input}
                    keyboardType="decimal-pad"
                    value={weight}
                    onChangeText={(text) => setWeight(sanitizeWeightInput(text))}
                    placeholder="0"
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
            </>
          )}

          <View style={styles.actions}>
            <PrimaryButton label="Save Set" onPress={handleConfirm} loading={saving} disabled={!canSave} />
            <Pressable onPress={onReject} style={styles.cancel} disabled={saving}>
              <AppText variant="body" color="textSecondary">
                Cancel
              </AppText>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: LiftFlowColors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xxl,
    gap: Spacing.lg,
  },
  transcript: {
    fontStyle: 'italic',
  },
  parsed: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
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
    gap: Spacing.md,
  },
  cancel: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
});
