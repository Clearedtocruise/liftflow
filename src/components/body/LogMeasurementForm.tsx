import { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useUnits } from '@/hooks/useUnits';
import { bodyService } from '@/services/bodyService';
import type { BodyCompositionRecord } from '@/types';

type LogMeasurementFormProps = {
  userId: string;
  /** Shown above the fields; omit inside a screen that already has a heading. */
  title?: string;
  subtitle?: string;
  saveLabel?: string;
  onSaved?: (record: BodyCompositionRecord) => void;
};

/**
 * Single measurement form shared by the Progress tab and the daily check-in, so both write the
 * same `body_composition_records` shape that the transformation timeline reads.
 */
export function LogMeasurementForm({
  userId,
  title,
  subtitle,
  saveLabel = 'Save measurement',
  onSaved,
}: LogMeasurementFormProps) {
  const units = useUnits();
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [saving, setSaving] = useState(false);

  const hasInput = weight.trim().length > 0 || waist.trim().length > 0 || bodyFat.trim().length > 0;

  async function handleSave() {
    if (!hasInput || saving) return;

    const weightKg = units.parseWeight(weight);
    const waistCm = units.parseMeasurement(waist);
    const bf = bodyFat ? parseFloat(bodyFat) : undefined;

    if (bf != null && (!Number.isFinite(bf) || bf <= 0 || bf >= 70)) {
      Alert.alert('Check body fat', 'Enter a body fat percentage between 1 and 70.');
      return;
    }

    const leanMassKg =
      weightKg && bf != null ? Math.round(weightKg * (1 - bf / 100) * 100) / 100 : undefined;

    setSaving(true);
    const result = await bodyService.recordComposition(userId, {
      userId,
      recordedAt: new Date().toISOString(),
      weightKg,
      waistCm,
      bodyFatPct: bf,
      leanMassKg,
      estimationMethod: 'manual',
    });
    setSaving(false);

    if (!result.success) {
      Alert.alert('Error', result.error);
      return;
    }

    setWeight('');
    setWaist('');
    setBodyFat('');
    onSaved?.(result.data);
  }

  return (
    <Card style={styles.card}>
      {title ? (
        <AppText variant="label" color="accent">
          {title}
        </AppText>
      ) : null}
      {subtitle ? (
        <AppText variant="footnote" color="textSecondary">
          {subtitle}
        </AppText>
      ) : null}

      <View style={styles.fields}>
        <TextInput
          style={styles.input}
          placeholder={`Weight (${units.weightLabel})`}
          placeholderTextColor={LiftFlowColors.textTertiary}
          keyboardType="numeric"
          value={weight}
          onChangeText={setWeight}
          accessibilityLabel={`Weight in ${units.weightLabel}`}
          autoFocus
        />
        <TextInput
          style={styles.input}
          placeholder={`Waist (${units.measurementLabel}) — optional`}
          placeholderTextColor={LiftFlowColors.textTertiary}
          keyboardType="numeric"
          value={waist}
          onChangeText={setWaist}
          accessibilityLabel={`Waist in ${units.measurementLabel}, optional`}
        />
        <TextInput
          style={styles.input}
          placeholder="Body fat % — optional"
          placeholderTextColor={LiftFlowColors.textTertiary}
          keyboardType="numeric"
          value={bodyFat}
          onChangeText={setBodyFat}
          accessibilityLabel="Body fat percentage, optional"
        />
      </View>

      <PrimaryButton
        label={saveLabel}
        onPress={handleSave}
        loading={saving}
        disabled={!hasInput || saving}
      />
      <AppText variant="caption" color="textTertiary">
        Weight alone is enough — your timeline carries body fat forward from your last reading.
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.sm },
  fields: { gap: Spacing.sm },
  input: {
    minHeight: TouchTarget.min,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    paddingHorizontal: Spacing.md,
    color: LiftFlowColors.textPrimary,
    backgroundColor: LiftFlowColors.backgroundSecondary,
  },
});
