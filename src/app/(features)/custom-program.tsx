import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { ExercisePickerModal } from '@/components/workout/execution/ExercisePickerModal';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import {
  addExercise,
  createEmptyDraft,
  cycleToDraft,
  draftToCycleInput,
  isDraftValid,
  moveExercise,
  removeExercise,
  setCycleLength,
  setDayLabel,
  toggleRestDay,
  updateExerciseField,
  CYCLE_LENGTH_MAX,
  CYCLE_LENGTH_MIN,
  type DraftDay,
} from '@/lib/programCycleEditor';
import { trainingService } from '@/services/trainingService';

export default function CustomProgramScreen() {
  const { user } = useAuth();
  const { hasBasicAccess } = useSubscription();
  const canUse = hasBasicAccess('custom-programs');

  const [name, setName] = useState('');
  const [days, setDays] = useState<DraftDay[]>(() => createEmptyDraft(3));
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [picker, setPicker] = useState<{ dayIndex: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await trainingService.getProgramCycle(user?.timezone);
      if (cancelled) return;
      if (result.success && result.data?.cycle) {
        setName(result.data.cycle.name ?? '');
        setDays(cycleToDraft(result.data.cycle.days));
        setEditing(true);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.timezone]);

  const validation = useMemo(() => isDraftValid(days), [days]);

  async function handleSave() {
    if (!user) return;
    if (!validation.valid) {
      Alert.alert('Not ready yet', validation.reason ?? 'Add at least one exercise.');
      return;
    }
    setSaving(true);
    const input = draftToCycleInput(name, days);
    const result = editing
      ? await trainingService.updateProgramCycle(input, user.timezone)
      : await trainingService.createProgramCycle(input, user.timezone);
    setSaving(false);
    if (!result.success) {
      Alert.alert('Could not save program', result.error);
      return;
    }
    Alert.alert(
      editing ? 'Program updated' : 'Program created',
      editing
        ? 'Your changes apply to upcoming workouts. Completed workouts stay in your history.'
        : `Your ${days.length}-day program is live and will loop back to Day 1 automatically.`,
      [{ text: 'Done', onPress: () => router.replace('/(tabs)/workout') }],
    );
  }

  if (!canUse) {
    return (
      <ScreenContainer contentContainerStyle={styles.content}>
        <Card style={styles.gate}>
          <AppText variant="title">Custom Programs</AppText>
          <AppText variant="body" color="textSecondary">
            Build your own 1–30 day training rotation with workout and rest days that automatically
            loops back to Day 1. Included with ONE MORE Basic ($4.99/month).
          </AppText>
          <PrimaryButton label="See plans" onPress={() => router.push('/(features)/subscription')} />
        </Card>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer contentContainerStyle={styles.content}>
      <AppText variant="title">{editing ? 'Edit Program' : 'Create Program'}</AppText>
      <AppText variant="footnote" color="textSecondary">
        Day 1 → Day {days.length}, then back to Day 1. Editing changes future workouts only — your
        history is never rewritten.
      </AppText>

      <Card style={styles.section}>
        <AppText variant="subhead" color="textSecondary">
          Program name
        </AppText>
        <TextInput
          style={styles.input}
          placeholder="e.g. My PPL Split"
          placeholderTextColor={LiftFlowColors.textTertiary}
          value={name}
          onChangeText={setName}
        />
      </Card>

      <Card style={styles.section}>
        <AppText variant="subhead" color="textSecondary">
          Program length — {days.length} {days.length === 1 ? 'day' : 'days'}
        </AppText>
        <View style={styles.lengthRow}>
          <Stepper
            label="−"
            disabled={days.length <= CYCLE_LENGTH_MIN}
            onPress={() => setDays((d) => setCycleLength(d, d.length - 1))}
          />
          <AppText variant="metric" style={styles.lengthValue}>
            {days.length}
          </AppText>
          <Stepper
            label="+"
            disabled={days.length >= CYCLE_LENGTH_MAX}
            onPress={() => setDays((d) => setCycleLength(d, d.length + 1))}
          />
        </View>
        <AppText variant="caption" color="textTertiary">
          1–30 days. Not tied to a Mon–Sun week.
        </AppText>
      </Card>

      {days.map((day, dayIndex) => (
        <Card key={dayIndex} style={styles.dayCard}>
          <View style={styles.dayHeader}>
            <AppText variant="label" color="accent">
              Day {dayIndex + 1}
            </AppText>
            <Pressable
              accessibilityRole="button"
              style={[styles.restToggle, day.isRest && styles.restToggleActive]}
              onPress={() => setDays((d) => toggleRestDay(d, dayIndex))}>
              <AppText variant="caption" color={day.isRest ? 'accent' : 'textSecondary'}>
                {day.isRest ? 'Rest day' : 'Workout day'}
              </AppText>
            </Pressable>
          </View>

          {day.isRest ? (
            <AppText variant="body" color="textSecondary">
              Rest — no workout scheduled.
            </AppText>
          ) : (
            <>
              <TextInput
                style={styles.dayLabel}
                placeholder={`Day ${dayIndex + 1} name (e.g. Push)`}
                placeholderTextColor={LiftFlowColors.textTertiary}
                value={day.label}
                onChangeText={(text) => setDays((d) => setDayLabel(d, dayIndex, text))}
              />

              {day.exercises.map((exercise, exIndex) => (
                <View key={exIndex} style={styles.exerciseRow}>
                  <View style={styles.exerciseMain}>
                    <AppText variant="bodyBold">{exercise.name}</AppText>
                    <View style={styles.exerciseFields}>
                      <NumberField
                        label="Sets"
                        value={exercise.sets}
                        onChange={(v) => setDays((d) => updateExerciseField(d, dayIndex, exIndex, { sets: v }))}
                      />
                      <TextField
                        label="Reps"
                        value={exercise.reps}
                        onChange={(v) => setDays((d) => updateExerciseField(d, dayIndex, exIndex, { reps: v }))}
                      />
                      <NumberField
                        label="Weight (lb)"
                        value={exercise.weightLbs ?? 0}
                        onChange={(v) => setDays((d) => updateExerciseField(d, dayIndex, exIndex, { weightLbs: v }))}
                      />
                    </View>
                  </View>
                  <View style={styles.exerciseActions}>
                    <TinyButton label="↑" disabled={exIndex === 0} onPress={() => setDays((d) => moveExercise(d, dayIndex, exIndex, exIndex - 1))} />
                    <TinyButton
                      label="↓"
                      disabled={exIndex === day.exercises.length - 1}
                      onPress={() => setDays((d) => moveExercise(d, dayIndex, exIndex, exIndex + 1))}
                    />
                    <TinyButton label="✕" onPress={() => setDays((d) => removeExercise(d, dayIndex, exIndex))} />
                  </View>
                </View>
              ))}

              <Pressable style={styles.addExercise} onPress={() => setPicker({ dayIndex })}>
                <AppText variant="bodyBold" color="accent">
                  + Add exercise
                </AppText>
              </Pressable>
            </>
          )}
        </Card>
      ))}

      {!validation.valid ? (
        <AppText variant="caption" color="textTertiary">
          {validation.reason}
        </AppText>
      ) : null}

      <PrimaryButton
        label={saving ? 'Saving…' : editing ? 'Save changes' : 'Create program'}
        onPress={() => void handleSave()}
        loading={saving}
        disabled={saving || loading}
      />

      <ExercisePickerModal
        visible={picker != null}
        title="Add Exercise"
        onClose={() => setPicker(null)}
        onSelect={(exercise) => {
          if (picker == null) return;
          setDays((d) => addExercise(d, picker.dayIndex, { name: exercise.name, sets: 3, reps: '8-10', exerciseId: exercise.id }));
        }}
      />
    </ScreenContainer>
  );
}

function Stepper({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      style={[styles.stepper, disabled && styles.stepperDisabled]}
      disabled={disabled}
      onPress={onPress}>
      <AppText variant="title" color={disabled ? 'textTertiary' : 'accent'}>
        {label}
      </AppText>
    </Pressable>
  );
}

function TinyButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={8}
      style={[styles.tinyButton, disabled && styles.tinyButtonDisabled]}
      disabled={disabled}
      onPress={onPress}>
      <AppText variant="bodyBold" color={disabled ? 'textTertiary' : 'textSecondary'}>
        {label}
      </AppText>
    </Pressable>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.field}>
      <AppText variant="caption" color="textTertiary">
        {label}
      </AppText>
      <TextInput
        style={styles.fieldInput}
        keyboardType="number-pad"
        value={value > 0 ? String(value) : ''}
        placeholder="0"
        placeholderTextColor={LiftFlowColors.textTertiary}
        onChangeText={(text) => onChange(parseInt(text.replace(/[^0-9]/g, ''), 10) || 0)}
      />
    </View>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.field}>
      <AppText variant="caption" color="textTertiary">
        {label}
      </AppText>
      <TextInput
        style={styles.fieldInput}
        value={value}
        placeholder="8-10"
        placeholderTextColor={LiftFlowColors.textTertiary}
        onChangeText={onChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.md, paddingBottom: Spacing.huge },
  gate: { gap: Spacing.md, alignItems: 'flex-start' },
  section: { gap: Spacing.sm },
  input: {
    backgroundColor: LiftFlowColors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    color: LiftFlowColors.textPrimary,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
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
  dayCard: { gap: Spacing.sm },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  restToggle: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  restToggleActive: { borderColor: LiftFlowColors.accentMuted, backgroundColor: LiftFlowColors.accentGlow },
  dayLabel: {
    backgroundColor: LiftFlowColors.surface,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    color: LiftFlowColors.textPrimary,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  exerciseRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.border,
  },
  exerciseMain: { flex: 1, gap: Spacing.xs },
  exerciseFields: { flexDirection: 'row', gap: Spacing.sm },
  exerciseActions: { justifyContent: 'space-between', alignItems: 'center' },
  field: { flex: 1, gap: 2 },
  fieldInput: {
    backgroundColor: LiftFlowColors.surfaceElevated,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    color: LiftFlowColors.textPrimary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.border,
  },
  tinyButton: {
    width: 32,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tinyButtonDisabled: { opacity: 0.35 },
  addExercise: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.accentMuted,
  },
});
