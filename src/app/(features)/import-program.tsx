import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { usePlanAdjustment } from '@/contexts/PlanAdjustmentContext';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { planDataCache } from '@/lib/planDataCache';
import { invalidateWeekPlanPrefetch, warmWeekPlanData } from '@/lib/planDataPrefetch';
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
  const [preview, setPreview] = useState<ProgramImportPreview | null>(null);
  const [busy, setBusy] = useState(false);

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

  const pickPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      setFileName(asset.name ?? 'program.pdf');
      setPdfBase64(base64);
      setPreview(null);
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
        setPreview(result.data);
        return;
      }
      setPreview(result.data);
    } finally {
      setBusy(false);
    }
  };

  const runCommit = async () => {
    if (!preview || !user) return;
    setBusy(true);
    try {
      const result = await trainingService.commitProgramImport({
        kind,
        preview,
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
      if (result.data.nutrition) {
        buttons.push({ text: 'Open Nutrition', onPress: () => router.push('/(tabs)/nutrition') });
      }
      if (result.data.workout) {
        buttons.push({ text: 'Open Workout', onPress: () => router.push('/(tabs)/workout') });
      }
      Alert.alert('Plan applied', parts.join('\n') || preview.summary, buttons);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <AppText variant="title">Import program PDF</AppText>
        <AppText style={styles.muted}>
          Upload a workout program, a nutrition plan, or both. Workouts become a looping Day 1–N cycle you
          can track; nutrition loads as this week’s meals and targets.
        </AppText>

        <AppText style={styles.section}>What to import</AppText>
        <View style={styles.kindRow}>
          {KINDS.map((option) => {
            const active = kind === option.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => {
                  setKind(option.id);
                  setPreview(null);
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
              setPreview(null);
            }}
            placeholder={'Day 1 — Push\nBench Press 4x8\n…'}
            placeholderTextColor={LiftFlowColors.textTertiary}
            multiline
            style={styles.textArea}
          />
        </Card>

        <PrimaryButton
          label={busy && !preview ? 'Reading…' : 'Read plan'}
          onPress={() => void runPreview()}
          disabled={busy}
          loading={busy && !preview}
        />

        {busy ? (
          <View style={styles.busy}>
            <ActivityIndicator color={LiftFlowColors.accent} />
          </View>
        ) : null}

        {preview ? (
          <Card style={styles.card}>
            <AppText style={styles.cardTitle}>{preview.title ?? 'Preview'}</AppText>
            <AppText>{preview.summary}</AppText>
            {preview.workout ? (
              <AppText style={styles.detail}>
                Workout: {preview.workout.lengthDays} days ·{' '}
                {preview.workout.days.filter((d) => !d.isRest).length} training ·{' '}
                {preview.workout.days.filter((d) => d.isRest).length} rest
              </AppText>
            ) : null}
            {preview.nutrition ? (
              <AppText style={styles.detail}>
                Nutrition:{' '}
                {preview.nutrition.days.reduce((n, d) => n + d.meals.length, 0)} meals
                {preview.nutrition.goals?.calories
                  ? ` · ~${preview.nutrition.goals.calories} kcal`
                  : ''}
                {preview.nutrition.goals?.proteinG
                  ? ` · ${preview.nutrition.goals.proteinG}g protein`
                  : ''}
              </AppText>
            ) : null}
            {preview.warnings.length > 0 ? (
              <AppText style={styles.warn}>{preview.warnings.join('\n')}</AppText>
            ) : null}
            <PrimaryButton
              label={busy ? 'Applying…' : 'Follow this plan'}
              onPress={() => void runCommit()}
              disabled={busy || (!preview.workout && !preview.nutrition)}
              loading={busy}
            />
          </Card>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: Spacing.md, paddingBottom: Spacing.xl },
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
  busy: { alignItems: 'center', padding: Spacing.md },
  detail: { color: LiftFlowColors.textSecondary, marginTop: Spacing.xs },
  warn: { color: LiftFlowColors.warning, marginTop: Spacing.xs },
});
