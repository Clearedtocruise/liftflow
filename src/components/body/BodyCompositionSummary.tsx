import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { Spacing } from '@/constants/theme';
import type { BodyCompositionRecord } from '@/types';
import type { BodyCompositionSnapshot, TransformationProjection } from '@/types/transformation';

type BodyCompositionSummaryProps = {
  latestMeasurement?: BodyCompositionRecord;
  projection?: TransformationProjection | null;
  formatWeight: (kg: number) => string;
};

function computeLeanFat(weightKg: number, bodyFatPct: number) {
  const fatMassKg = Math.round(weightKg * (bodyFatPct / 100) * 100) / 100;
  const leanMassKg = Math.round((weightKg - fatMassKg) * 100) / 100;
  return { leanMassKg, fatMassKg };
}

export function BodyCompositionSummary({
  latestMeasurement,
  projection,
  formatWeight,
}: BodyCompositionSummaryProps) {
  const snapshot: BodyCompositionSnapshot | null = projection?.current
    ? projection.current
    : latestMeasurement?.weightKg && latestMeasurement.bodyFatPct
      ? {
          weightKg: latestMeasurement.weightKg,
          bodyFatPct: latestMeasurement.bodyFatPct,
          ...computeLeanFat(latestMeasurement.weightKg, latestMeasurement.bodyFatPct),
        }
      : null;

  if (!snapshot) {
    return (
      <Card style={styles.card}>
        <AppText variant="body" color="textSecondary">
          Log weight and body fat % to see lean mass and fat mass estimates.
        </AppText>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <AppText variant="label" color="accent">
        Body Composition
      </AppText>
      <View style={styles.grid}>
        <Stat label="Body fat" value={`${snapshot.bodyFatPct}%`} />
        <Stat label="Weight" value={formatWeight(snapshot.weightKg)} />
        <Stat label="Lean mass" value={`${snapshot.leanMassKg} kg`} />
        <Stat label="Fat mass" value={`${snapshot.fatMassKg} kg`} />
      </View>
      {projection?.workoutAdherencePct != null ? (
        <AppText variant="footnote" color="textTertiary">
          Workout adherence {projection.workoutAdherencePct}% · Nutrition {projection.nutritionAdherencePct ?? '—'}%
          {projection.projectedWeeksToTarget != null ? ` · ~${projection.projectedWeeksToTarget} wks to target` : ''}
        </AppText>
      ) : null}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <AppText variant="caption" color="textSecondary">
        {label}
      </AppText>
      <AppText variant="bodyBold">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.md, marginBottom: Spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  stat: { minWidth: '42%', gap: Spacing.xs },
});
