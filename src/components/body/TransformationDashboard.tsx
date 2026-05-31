import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { BodyCompositionSummary } from '@/components/body/BodyCompositionSummary';
import { PhotoComparisonSlider } from '@/components/body/PhotoComparisonSlider';
import { TransformationTimeline } from '@/components/body/TransformationTimeline';
import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { classifyPhotos } from '@/lib/transformation/photoRoles';
import type { BodyCompositionRecord, ProgressPhoto } from '@/types';
import {
    TRANSFORMATION_BF_PRESETS,
    type ComparisonMode,
    type TransformationProjection,
} from '@/types/transformation';

const MODES: Array<{ id: ComparisonMode; label: string }> = [
  { id: 'before_current', label: 'Before vs Current' },
  { id: 'before_projected', label: 'Before vs Projected' },
  { id: 'current_projected', label: 'Current vs Projected' },
  { id: 'timeline', label: 'Timeline' },
];

type TransformationDashboardProps = {
  photos: ProgressPhoto[];
  measurements: BodyCompositionRecord[];
  projection: TransformationProjection | null;
  history: TransformationProjection[];
  targetBf: string;
  onTargetBfChange: (value: string) => void;
  onRun: () => void;
  running?: boolean;
  formatWeight: (kg: number) => string;
  projectedImageUrl?: string;
};

export function TransformationDashboard({
  photos,
  measurements,
  projection,
  history,
  targetBf,
  onTargetBfChange,
  onRun,
  running,
  formatWeight,
  projectedImageUrl,
}: TransformationDashboardProps) {
  const [mode, setMode] = useState<ComparisonMode>('before_current');
  const classified = classifyPhotos(photos);
  const before = classified.find((p) => p.role === 'before') ?? classified[0];
  const current = classified.find((p) => p.role === 'current') ?? classified[classified.length - 1];
  const latestMeasurement = measurements[0];

  return (
    <View style={styles.wrap}>
      <AppText variant="label" color="accent">
        Transformation Dashboard
      </AppText>

      <BodyCompositionSummary
        latestMeasurement={latestMeasurement}
        projection={projection}
        formatWeight={formatWeight}
      />

      <ScrollModes mode={mode} onChange={setMode} />

      {mode === 'timeline' ? (
        <TransformationTimeline history={history.length ? history : projection ? [projection] : []} formatWeight={formatWeight} />
      ) : mode === 'before_current' ? (
        <PhotoComparisonSlider
          leftLabel="Before"
          rightLabel="Current"
          leftUri={before?.photoUrl}
          rightUri={current?.photoUrl}
        />
      ) : mode === 'before_projected' ? (
        <View style={styles.dual}>
          <PhotoComparisonSlider
            leftLabel="Before"
            rightLabel="Projected"
            leftUri={before?.photoUrl}
            rightUri={projectedImageUrl ?? projection?.currentPhotoUrl}
          />
          {projection ? <ProjectedStats projection={projection} formatWeight={formatWeight} /> : null}
        </View>
      ) : (
        <View style={styles.dual}>
          <PhotoComparisonSlider
            leftLabel="Current"
            rightLabel="Projected"
            leftUri={current?.photoUrl}
            rightUri={projectedImageUrl ?? projection?.currentPhotoUrl}
          />
          {projection ? <ProjectedStats projection={projection} formatWeight={formatWeight} /> : null}
        </View>
      )}

      <View style={styles.presets}>
        {TRANSFORMATION_BF_PRESETS.map((pct) => (
          <Pressable
            key={pct}
            style={[styles.presetChip, targetBf === String(pct) && styles.presetActive]}
            onPress={() => onTargetBfChange(String(pct))}>
            <AppText variant="caption">{pct}%</AppText>
          </Pressable>
        ))}
        <TextInput
          style={styles.bfInput}
          value={targetBf}
          onChangeText={onTargetBfChange}
          keyboardType="numeric"
          placeholder="BF %"
          placeholderTextColor={LiftFlowColors.textTertiary}
        />
      </View>

      <PrimaryButton
        label={running ? 'Calculating…' : 'Run Transformation Projection'}
        onPress={onRun}
        disabled={running}
      />

      {projection ? (
        <Card style={styles.detailCard}>
          <AppText variant="bodyBold">
            Target {projection.targetBodyFatPct}% · {formatWeight(projection.projected.weightKg)} projected
          </AppText>
          <AppText variant="footnote" color="textSecondary">
            Lean {projection.projected.leanMassKg} kg · Fat {projection.projected.fatMassKg} kg
            {projection.projectedWeeksToTarget != null ? ` · ~${projection.projectedWeeksToTarget} wks` : ''}
          </AppText>
          <AppText variant="footnote" color="textTertiary">
            {projection.rationale}
          </AppText>
        </Card>
      ) : null}
    </View>
  );
}

function ScrollModes({ mode, onChange }: { mode: ComparisonMode; onChange: (m: ComparisonMode) => void }) {
  return (
    <View style={styles.modeRow}>
      {MODES.map((m) => (
        <Pressable
          key={m.id}
          style={[styles.modeChip, mode === m.id && styles.modeChipActive]}
          onPress={() => onChange(m.id)}>
          <AppText variant="caption">{m.label}</AppText>
        </Pressable>
      ))}
    </View>
  );
}

function ProjectedStats({
  projection,
  formatWeight,
}: {
  projection: TransformationProjection;
  formatWeight: (kg: number) => string;
}) {
  return (
    <View style={styles.projectedBox}>
      <AppText variant="headline">{projection.targetBodyFatPct}%</AppText>
      <AppText variant="bodyBold">{formatWeight(projection.projected.weightKg)}</AppText>
      <AppText variant="caption" color="textSecondary">
        Lean {projection.projected.leanMassKg} kg · Fat {projection.projected.fatMassKg} kg
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md, marginBottom: Spacing.xxl },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  modeChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  modeChipActive: {
    borderColor: LiftFlowColors.accent,
    backgroundColor: LiftFlowColors.primaryMuted,
  },
  dual: { gap: Spacing.md },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, alignItems: 'center' },
  presetChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  presetActive: { borderColor: LiftFlowColors.accent, backgroundColor: LiftFlowColors.primaryMuted },
  bfInput: {
    minWidth: 56,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    color: LiftFlowColors.textPrimary,
    textAlign: 'center',
  },
  detailCard: { gap: Spacing.sm },
  projectedBox: {
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.surface,
  },
});
