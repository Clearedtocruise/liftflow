import { Image, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { TRANSFORMATION_BF_PRESETS, type TransformationProjection } from '@/types/transformation';

type TransformationPanelProps = {
  projection: TransformationProjection | null;
  targetBf: string;
  onTargetBfChange: (value: string) => void;
  onRun: () => void;
  running?: boolean;
  formatWeight: (kg: number) => string;
};

export function TransformationPanel({
  projection,
  targetBf,
  onTargetBfChange,
  onRun,
  running,
  formatWeight,
}: TransformationPanelProps) {
  const beforeUrl = projection?.beforePhotoUrl;
  const currentUrl = projection?.currentPhotoUrl;

  return (
    <View style={styles.wrap}>
      <AppText variant="label" color="accent">
        Before · Current · Projected
      </AppText>

      <View style={styles.row}>
        <PhotoColumn label="Before" url={beforeUrl} placeholder="Earliest photo" />
        <PhotoColumn label="Current" url={currentUrl} placeholder="Latest photo" />
        <ProjectedColumn projection={projection} formatWeight={formatWeight} />
      </View>

      <View style={styles.presets}>
        {TRANSFORMATION_BF_PRESETS.map((pct) => (
          <Pressable
            key={pct}
            style={[styles.presetChip, targetBf === String(pct) && styles.presetActive]}
            onPress={() => onTargetBfChange(String(pct))}>
            <AppText variant="caption">{pct}%</AppText>
          </Pressable>
        ))}
      </View>

      <PrimaryButton label={running ? 'Calculating…' : 'Run Transformation Projection'} onPress={onRun} disabled={running} />

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

function PhotoColumn({ label, url, placeholder }: { label: string; url?: string; placeholder: string }) {
  return (
    <View style={styles.column}>
      <AppText variant="caption" color="textSecondary">
        {label}
      </AppText>
      {url ? (
        <Image source={{ uri: url }} style={styles.photo} />
      ) : (
        <View style={[styles.photo, styles.placeholder]}>
          <AppText variant="caption" color="textTertiary">
            {placeholder}
          </AppText>
        </View>
      )}
    </View>
  );
}

function ProjectedColumn({
  projection,
  formatWeight,
}: {
  projection: TransformationProjection | null;
  formatWeight: (kg: number) => string;
}) {
  return (
    <View style={styles.column}>
      <AppText variant="caption" color="accent">
        Projected
      </AppText>
      <View style={[styles.photo, styles.projectedBox]}>
        {projection ? (
          <>
            <AppText variant="headline">{projection.targetBodyFatPct}%</AppText>
            <AppText variant="bodyBold">{formatWeight(projection.projected.weightKg)}</AppText>
            <AppText variant="caption" color="textSecondary">
              Lean {projection.projected.leanMassKg} kg
            </AppText>
            <AppText variant="caption" color="textSecondary">
              Fat {projection.projected.fatMassKg} kg
            </AppText>
          </>
        ) : (
          <AppText variant="caption" color="textTertiary">
            Run projection
          </AppText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md, marginBottom: Spacing.xxl },
  row: { flexDirection: 'row', gap: Spacing.sm },
  column: { flex: 1, gap: Spacing.xs, alignItems: 'center' },
  photo: {
    width: '100%',
    height: 140,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.surface,
  },
  placeholder: { alignItems: 'center', justifyContent: 'center', padding: Spacing.sm },
  projectedBox: { alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, padding: Spacing.sm },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  presetChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  presetActive: { borderColor: LiftFlowColors.accent, backgroundColor: LiftFlowColors.primaryMuted },
  detailCard: { gap: Spacing.sm },
});
