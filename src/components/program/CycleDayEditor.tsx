/**
 * One editable day of a day-based program.
 *
 * Shared by the custom program editor and the PDF import review so a day reads and edits the same
 * way whether the plan was typed in by hand or read out of a document — including the day's name,
 * which is what the week view and every materialized workout is titled after.
 */

import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import type { DraftDay, DraftExercise } from '@/lib/programCycleEditor';

type CycleDayEditorProps = {
  day: DraftDay;
  dayIndex: number;
  onToggleRest: () => void;
  onLabelChange: (label: string) => void;
  onExerciseField: (exerciseIndex: number, patch: Partial<DraftExercise>) => void;
  onMoveExercise: (exerciseIndex: number, to: number) => void;
  onRemoveExercise: (exerciseIndex: number) => void;
  onAddExercise: () => void;
};

export function CycleDayEditor({
  day,
  dayIndex,
  onToggleRest,
  onLabelChange,
  onExerciseField,
  onMoveExercise,
  onRemoveExercise,
  onAddExercise,
}: CycleDayEditorProps) {
  return (
    <Card style={styles.dayCard}>
      <View style={styles.dayHeader}>
        <AppText variant="label" color="accent">
          Day {dayIndex + 1}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={day.isRest ? `Day ${dayIndex + 1} is a rest day` : `Day ${dayIndex + 1} is a workout day`}
          style={[styles.restToggle, day.isRest && styles.restToggleActive]}
          onPress={onToggleRest}>
          <AppText variant="caption" color={day.isRest ? 'accent' : 'textSecondary'}>
            {day.isRest ? 'Rest day' : 'Workout day'}
          </AppText>
        </Pressable>
      </View>

      {/* Outside the rest-day branch on purpose: a rest day is still worth naming ("Active
          recovery", "Travel"), and that name is what the week view shows for the day. */}
      <TextInput
        style={styles.dayLabel}
        accessibilityLabel={`Name for day ${dayIndex + 1}`}
        placeholder={day.isRest ? 'Rest day name (e.g. Active recovery)' : `Day ${dayIndex + 1} name (e.g. Push)`}
        placeholderTextColor={LiftFlowColors.textTertiary}
        value={day.label}
        onChangeText={onLabelChange}
      />

      {day.isRest ? (
        <AppText variant="body" color="textSecondary">
          Rest — no workout scheduled.
        </AppText>
      ) : (
        <>
          {day.exercises.map((exercise, exIndex) => (
            <View key={exIndex} style={styles.exerciseRow}>
              <View style={styles.exerciseMain}>
                <AppText variant="bodyBold">{exercise.name}</AppText>
                <View style={styles.exerciseFields}>
                  <NumberField
                    label="Sets"
                    value={exercise.sets}
                    onChange={(v) => onExerciseField(exIndex, { sets: v })}
                  />
                  <TextField
                    label="Reps"
                    value={exercise.reps}
                    onChange={(v) => onExerciseField(exIndex, { reps: v })}
                  />
                  <NumberField
                    label="Weight (lb)"
                    value={exercise.weightLbs ?? 0}
                    onChange={(v) => onExerciseField(exIndex, { weightLbs: v })}
                  />
                </View>
              </View>
              <View style={styles.exerciseActions}>
                <TinyButton
                  label="↑"
                  accessibilityLabel={`Move ${exercise.name} up`}
                  disabled={exIndex === 0}
                  onPress={() => onMoveExercise(exIndex, exIndex - 1)}
                />
                <TinyButton
                  label="↓"
                  accessibilityLabel={`Move ${exercise.name} down`}
                  disabled={exIndex === day.exercises.length - 1}
                  onPress={() => onMoveExercise(exIndex, exIndex + 1)}
                />
                <TinyButton
                  label="✕"
                  accessibilityLabel={`Remove ${exercise.name}`}
                  onPress={() => onRemoveExercise(exIndex)}
                />
              </View>
            </View>
          ))}

          {day.exercises.length === 0 ? (
            <AppText variant="caption" color="textTertiary">
              No exercises read for this day — add them, or mark it as a rest day.
            </AppText>
          ) : null}

          <Pressable style={styles.addExercise} onPress={onAddExercise}>
            <AppText variant="bodyBold" color="accent">
              + Add exercise
            </AppText>
          </Pressable>
        </>
      )}
    </Card>
  );
}

export function TinyButton({
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

export function NumberField({
  label,
  value,
  onChange,
  placeholder = '0',
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <AppText variant="caption" color="textTertiary">
        {label}
      </AppText>
      <TextInput
        style={styles.fieldInput}
        accessibilityLabel={label}
        keyboardType="number-pad"
        value={value > 0 ? String(value) : ''}
        placeholder={placeholder}
        placeholderTextColor={LiftFlowColors.textTertiary}
        onChangeText={(text) => onChange(parseInt(text.replace(/[^0-9]/g, ''), 10) || 0)}
      />
    </View>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder = '8-10',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <AppText variant="caption" color="textTertiary">
        {label}
      </AppText>
      <TextInput
        style={styles.fieldInput}
        accessibilityLabel={label}
        value={value}
        placeholder={placeholder}
        placeholderTextColor={LiftFlowColors.textTertiary}
        onChangeText={onChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
