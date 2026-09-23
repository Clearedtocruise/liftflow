import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { CycleDayEditor } from '@/components/program/CycleDayEditor';
import { NutritionPlanEditor } from '@/components/program/NutritionPlanEditor';
import { AppText } from '@/components/ui/AppText';
import { ExercisePickerModal } from '@/components/workout/execution/ExercisePickerModal';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { usePlanAdjustment } from '@/contexts/PlanAdjustmentContext';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { planDataCache } from '@/lib/planDataCache';
import { invalidateWeekPlanPrefetch, warmWeekPlanData } from '@/lib/planDataPrefetch';
import {
  addExercise,
  moveExercise,
  removeExercise,
  setCycleLength,
  setDayExecutionMode,
  setDayIntervalField,
  setDayLabel,
  toggleRestDay,
  updateExerciseField,
  CYCLE_LENGTH_MAX,
  CYCLE_LENGTH_MIN,
} from '@/lib/programCycleEditor';
import {
  addMeal,
  describeImportDraft,
  importDraftIssue,
  importDraftToPreview,
  previewToImportDraft,
  removeMeal,
  setNutritionDayLabel,
  setNutritionGoal,
  setNutritionName,
  setWorkoutDays,
  setWorkoutName,
  updateMeal,
  type ImportDraft,
} from '@/lib/programImportDraft';
import { base64Bytes, oversizedPdfMessage } from '@/lib/programImportUpload';
import { trainingService } from '@/services/trainingService';
import type { ProgramImportKind, ProgramImportPreview } from '@/types/programImport';

const KINDS: Array<{ id: ProgramImportKind; label: string; hint: string }> = [
  { id: 'both', label: 'Workout + Nutrition', hint: 'Follow both from one PDF when present' },
  { id: 'workout', label: 'Workout only', hint: 'Build a looping Day 1–N program' },
  { id: 'nutrition', label: 'Nutrition only', hint: 'Load meals and targets for this week' },
];

export default function ImportProgramScreen() {
  const { user, refreshProfile } = useAuth();
  const { hasBasicAccess } = useSubscription();
  const { bumpRevision } = usePlanAdjustment();
  const canUse = hasBasicAccess('custom-programs');

  const [kind, setKind] = useState<ProgramImportKind>('both');
  const [fileName, setFileName] = useState<string | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [busy, setBusy] = useState(false);

  /**
   * The parse exactly as the server returned it. Kept alongside the draft so warnings, page count
   * and the parser's own summary still reach commit even though the user only edits the draft.
   */
  const [parsed, setParsed] = useState<ProgramImportPreview | null>(null);
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [picker, setPicker] = useState<{ dayIndex: number } | null>(null);

  const issue = useMemo(() => (draft ? importDraftIssue(draft, kind) : undefined), [draft, kind]);

  if (!canUse) {
    return (
      <ScreenContainer>
        <Card>
          <AppText variant="title">Import a program PDF</AppText>
          <AppText style={styles.muted}>
            Upload a workout or nutrition PDF to follow and track in ONE MORE. Available on Basic and Pro.
          </AppText>
          <PrimaryButton label="See plans" onPress={() => router.push('/(features)/upgrade')} />
        </Card>
      </ScreenContainer>
    );
  }

  const discardDraft = () => {
    setParsed(null);
    setDraft(null);
  };

  const pickPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];

      // Checked before the file is read, not after: loading twenty megabytes into a base64 string
      // to then refuse it costs the same memory as sending it would have.
      const tooLarge = oversizedPdfMessage(asset.size);
      if (tooLarge) {
        Alert.alert('PDF is too large', tooLarge);
        return;
      }

      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      // Not every picker reports a size, so the file is measured once it is in hand as well.
      const tooLargeOnRead = oversizedPdfMessage(base64Bytes(base64));
      if (tooLargeOnRead) {
        Alert.alert('PDF is too large', tooLargeOnRead);
        return;
      }

      setFileName(asset.name ?? 'program.pdf');
      setPdfBase64(base64);
      discardDraft();
    } catch (error) {
      Alert.alert('Could not open PDF', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const runPreview = async () => {
    if (!pdfBase64 && pastedText.trim().length < 40) {
      Alert.alert('Add a PDF or paste your plan', 'Pick a PDF file, or paste the workout/nutrition text.');
      return;
    }
    setBusy(true);
    try {
      const result = await trainingService.previewProgramImport({
        kind,
        pdfBase64: pdfBase64 ?? undefined,
        text: pdfBase64 ? undefined : pastedText,
        fileName: fileName ?? undefined,
      });
      if (!result.success) {
        Alert.alert('Could not read plan', result.error);
        return;
      }
      if (!result.data.workout && !result.data.nutrition) {
        Alert.alert(
          'Nothing usable found',
          result.data.warnings.join('\n') || 'Try a clearer PDF or paste the plan text.',
        );
        return;
      }
      setParsed(result.data);
      setDraft(previewToImportDraft(result.data));
    } finally {
      setBusy(false);
    }
  };

  const runCommit = async () => {
    if (!parsed || !draft || !user) return;
    if (issue) {
      Alert.alert('Not ready yet', issue);
      return;
    }
    setBusy(true);
    try {
      // The edited draft, not the parse. Following a plan the user just corrected and having the
      // uncorrected version go live is the whole reason this review step exists.
      const result = await trainingService.commitProgramImport({
        kind,
        preview: importDraftToPreview(draft, parsed),
        timeZone: user.timezone,
      });
      if (!result.success) {
        Alert.alert('Could not apply plan', result.error);
        return;
      }

      invalidateWeekPlanPrefetch(user.id, user.timezone);
      await planDataCache.clearUser(user.id);
      await warmWeekPlanData(user.id, user.timezone);
      bumpRevision();
      await refreshProfile();

      const parts: string[] = [];
      if (result.data.workout) {
        parts.push(
          `Workout cycle ready (Day ${result.data.workout.activeDayNumber} of ${result.data.workout.cycle.lengthDays})`,
        );
      }
      if (result.data.nutrition) {
        parts.push(
          `Nutrition: ${result.data.nutrition.mealsInserted} meals for week of ${result.data.nutrition.weekStart}`,
        );
      }

      const buttons: Array<{ text: string; style?: 'cancel'; onPress?: () => void }> = [
        { text: 'OK', style: 'cancel' },
      ];
      if (result.data.workout) {
        buttons.push({
          text: 'View full program',
          onPress: () => router.push('/(features)/custom-program'),
        });
        buttons.push({ text: 'Open Workout', onPress: () => router.push('/(tabs)/workout') });
      }
      if (result.data.nutrition) {
        buttons.push({ text: 'Open Nutrition', onPress: () => router.push('/(tabs)/nutrition') });
      }
      Alert.alert('Plan applied', parts.join('\n') || describeImportDraft(draft), buttons);
    } finally {
      setBusy(false);
    }
  };

  if (draft) {
    return (
      <>
        <ScreenContainer contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <AppText variant="title">Review your plan</AppText>
          <AppText style={styles.muted}>
            This is what we read from {fileName ?? 'your plan'}. Fix anything that came through wrong —
            names, sets, reps, meals — then follow it. Nothing is saved until you do.
          </AppText>
          <AppText style={styles.detail}>{describeImportDraft(draft)}</AppText>

          {parsed?.warnings.length ? (
            <AppText style={styles.warn}>{parsed.warnings.join('\n')}</AppText>
          ) : null}

          {draft.workout ? (
            <>
              <Card style={styles.card}>
                <AppText variant="subhead" color="textSecondary">
                  Program name
                </AppText>
                <TextInput
                  style={styles.input}
                  accessibilityLabel="Program name"
                  placeholder="e.g. My PPL Split"
                  placeholderTextColor={LiftFlowColors.textTertiary}
                  value={draft.workout.name}
                  onChangeText={(text) => setDraft((d) => (d ? setWorkoutName(d, text) : d))}
                />

                <AppText variant="subhead" color="textSecondary">
                  Cycle length — {draft.workout.days.length}{' '}
                  {draft.workout.days.length === 1 ? 'day' : 'days'}
                </AppText>
                <View style={styles.lengthRow}>
                  <Stepper
                    label="−"
                    accessibilityLabel="Remove a day from the cycle"
                    disabled={draft.workout.days.length <= CYCLE_LENGTH_MIN}
                    onPress={() =>
                      setDraft((d) =>
                        d?.workout ? setWorkoutDays(d, setCycleLength(d.workout.days, d.workout.days.length - 1)) : d,
                      )
                    }
                  />
                  <AppText variant="metric" style={styles.lengthValue}>
                    {draft.workout.days.length}
                  </AppText>
                  <Stepper
                    label="+"
                    accessibilityLabel="Add a day to the cycle"
                    disabled={draft.workout.days.length >= CYCLE_LENGTH_MAX}
                    onPress={() =>
                      setDraft((d) =>
                        d?.workout ? setWorkoutDays(d, setCycleLength(d.workout.days, d.workout.days.length + 1)) : d,
                      )
                    }
                  />
                </View>
                <AppText variant="caption" color="textTertiary">
                  Day 1 → Day {draft.workout.days.length}, then back to Day 1. Not tied to a Mon–Sun week.
                </AppText>
              </Card>

              {draft.workout.days.map((day, dayIndex) => (
                <CycleDayEditor
                  key={dayIndex}
                  day={day}
                  dayIndex={dayIndex}
                  onToggleRest={() =>
                    setDraft((d) => (d?.workout ? setWorkoutDays(d, toggleRestDay(d.workout.days, dayIndex)) : d))
                  }
                  onLabelChange={(text) =>
                    setDraft((d) => (d?.workout ? setWorkoutDays(d, setDayLabel(d.workout.days, dayIndex, text)) : d))
                  }
                  onExerciseField={(exIndex, patch) =>
                    setDraft((d) =>
                      d?.workout ? setWorkoutDays(d, updateExerciseField(d.workout.days, dayIndex, exIndex, patch)) : d,
                    )
                  }
                  onMoveExercise={(exIndex, to) =>
                    setDraft((d) =>
                      d?.workout ? setWorkoutDays(d, moveExercise(d.workout.days, dayIndex, exIndex, to)) : d,
                    )
                  }
                  onRemoveExercise={(exIndex) =>
                    setDraft((d) =>
                      d?.workout ? setWorkoutDays(d, removeExercise(d.workout.days, dayIndex, exIndex)) : d,
                    )
                  }
                  onAddExercise={() => setPicker({ dayIndex })}
                  onModeChange={(mode) =>
                    setDraft((d) => (d?.workout ? setWorkoutDays(d, setDayExecutionMode(d.workout.days, dayIndex, mode)) : d))
                  }
                  onIntervalChange={(key, value) =>
                    setDraft((d) =>
                      d?.workout ? setWorkoutDays(d, setDayIntervalField(d.workout.days, dayIndex, key, value)) : d,
                    )
                  }
                />
              ))}
            </>
          ) : null}

          {draft.nutrition ? (
            <NutritionPlanEditor
              nutrition={draft.nutrition}
              onNameChange={(text) => setDraft((d) => (d ? setNutritionName(d, text) : d))}
              onGoalChange={(key, value) => setDraft((d) => (d ? setNutritionGoal(d, key, value) : d))}
              onDayLabelChange={(dayIndex, label) =>
                setDraft((d) => (d ? setNutritionDayLabel(d, dayIndex, label) : d))
              }
              onMealChange={(dayIndex, mealIndex, patch) =>
                setDraft((d) => (d ? updateMeal(d, dayIndex, mealIndex, patch) : d))
              }
              onRemoveMeal={(dayIndex, mealIndex) => setDraft((d) => (d ? removeMeal(d, dayIndex, mealIndex) : d))}
              onAddMeal={(dayIndex) => setDraft((d) => (d ? addMeal(d, dayIndex) : d))}
            />
          ) : null}

          {issue ? (
            <AppText variant="caption" color="textTertiary">
              {issue}
            </AppText>
          ) : null}

          <PrimaryButton
            label={busy ? 'Applying…' : 'Follow this plan'}
            onPress={() => void runCommit()}
            disabled={busy || Boolean(issue)}
            loading={busy}
          />
          <PrimaryButton label="Start over" variant="secondary" onPress={discardDraft} disabled={busy} />
        </ScreenContainer>

        <ExercisePickerModal
          visible={picker != null}
          title="Add Exercise"
          onClose={() => setPicker(null)}
          onSelect={(exercise) => {
            if (picker == null) return;
            setDraft((d) =>
              d?.workout
                ? setWorkoutDays(
                    d,
                    addExercise(d.workout.days, picker.dayIndex, {
                      name: exercise.name,
                      sets: 3,
                      reps: '8-10',
                      exerciseId: exercise.id,
                    }),
                  )
                : d,
            );
          }}
        />
      </>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <AppText variant="title">Import program PDF</AppText>
        <AppText style={styles.muted}>
          Upload a workout program, a nutrition plan, or both. You get to review and fix everything we
          read before any of it goes live.
        </AppText>

        <AppText style={styles.section}>What to import</AppText>
        <View style={styles.kindRow}>
          {KINDS.map((option) => {
            const active = kind === option.id;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  setKind(option.id);
                  discardDraft();
                }}
                style={[styles.kindChip, active && styles.kindChipActive]}>
                <AppText style={[styles.kindLabel, active && styles.kindLabelActive]}>{option.label}</AppText>
                <AppText style={styles.kindHint}>{option.hint}</AppText>
              </Pressable>
            );
          })}
        </View>

        <Card style={styles.card}>
          <AppText style={styles.cardTitle}>PDF file</AppText>
          <PrimaryButton
            label={fileName ? 'Choose a different PDF' : 'Choose PDF'}
            onPress={() => void pickPdf()}
          />
          {fileName ? <AppText style={styles.fileName}>{fileName}</AppText> : null}
        </Card>

        <Card style={styles.card}>
          <AppText style={styles.cardTitle}>Or paste plan text</AppText>
          <TextInput
            value={pastedText}
            onChangeText={(value) => {
              setPastedText(value);
              if (value.trim()) {
                setPdfBase64(null);
                setFileName(null);
              }
              discardDraft();
            }}
            placeholder={'Day 1 — Push\nBench Press 4x8\n…'}
            placeholderTextColor={LiftFlowColors.textTertiary}
            multiline
            style={styles.textArea}
          />
        </Card>

        <PrimaryButton
          label={busy ? 'Reading…' : 'Read plan'}
          onPress={() => void runPreview()}
          disabled={busy}
          loading={busy}
        />

        {busy ? (
          <View style={styles.busy}>
            <ActivityIndicator color={LiftFlowColors.accent} />
            <AppText variant="caption" color="textSecondary">
              A scanned or photographed plan takes longer — we read the pages themselves.
            </AppText>
          </View>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

function Stepper({
  label,
  onPress,
  disabled,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.stepper, disabled && styles.stepperDisabled]}
      disabled={disabled}
      onPress={onPress}>
      <AppText variant="title" color={disabled ? 'textTertiary' : 'accent'}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: Spacing.md, paddingBottom: Spacing.huge },
  muted: { color: LiftFlowColors.textSecondary, marginTop: Spacing.xs },
  section: { marginTop: Spacing.sm, fontWeight: '600', color: LiftFlowColors.textPrimary },
  kindRow: { gap: Spacing.sm },
  kindChip: {
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    backgroundColor: LiftFlowColors.surface,
  },
  kindChipActive: {
    borderColor: LiftFlowColors.accentMuted,
    backgroundColor: LiftFlowColors.accentGlow,
  },
  kindLabel: { color: LiftFlowColors.textPrimary, fontWeight: '600' },
  kindLabelActive: { color: LiftFlowColors.accent },
  kindHint: { color: LiftFlowColors.textSecondary, marginTop: 4, fontSize: 13 },
  card: { gap: Spacing.sm },
  cardTitle: { fontWeight: '600', color: LiftFlowColors.textPrimary },
  fileName: { color: LiftFlowColors.textSecondary },
  input: {
    backgroundColor: LiftFlowColors.surface,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    color: LiftFlowColors.textPrimary,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  textArea: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    color: LiftFlowColors.textPrimary,
    backgroundColor: LiftFlowColors.surfaceElevated,
    textAlignVertical: 'top',
  },
  lengthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xl },
  lengthValue: { minWidth: 48, textAlign: 'center' },
  stepper: {
    width: 52,
    height: 52,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LiftFlowColors.surfaceElevated,
  },
  stepperDisabled: { opacity: 0.4 },
  busy: { alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  detail: { color: LiftFlowColors.textSecondary, marginTop: Spacing.xs },
  warn: { color: LiftFlowColors.warning, marginTop: Spacing.xs },
});
