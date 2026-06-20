import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { formatPlanTargetPerformance, formatPreviousPerformanceLine } from '@/lib/activeWorkoutMetrics';
import type { ExerciseLoggingMode } from '@/lib/exerciseModality';
import type { DistanceUnit } from '@/types/common';

type GuidedWorkoutMetricsProps = {
  currentSet: number;
  targetSets: number;
  remainingSets: number;
  loggingMode: ExerciseLoggingMode;
  repRange: string;
  historySets: ExerciseHistorySet[];
  targetPerformanceLine?: string | null;
  formatWeight: (kg: number) => string;
  weightLabel: string;
  distanceUnit: DistanceUnit;
  fallbackWeightKg?: number;
};

export function GuidedWorkoutMetrics({
  currentSet,
  targetSets,
  remainingSets,
  loggingMode,
  repRange,
  historySets,
  targetPerformanceLine,
  formatWeight,
  weightLabel,
  distanceUnit,
  fallbackWeightKg,
}: GuidedWorkoutMetricsProps) {
  const planFallback = formatPlanTargetPerformance(
    loggingMode,
    targetSets,
    repRange,
    formatWeight,
    weightLabel,
    fallbackWeightKg,
  );

  return (
    <View style={styles.container}>
      <View style={styles.metricRow}>
        <View style={styles.metricCell}>
          <AppText variant="caption" color="textSecondary">
            Current Set
          </AppText>
          <AppText variant="bodyBold">
            {Math.min(currentSet, targetSets)} of {targetSets}
          </AppText>
        </View>
        <View style={styles.metricCell}>
          <AppText variant="caption" color="textSecondary">
            Remaining Sets
          </AppText>
          <AppText variant="bodyBold">{Math.max(remainingSets, 0)}</AppText>
        </View>
      </View>

      <View style={styles.block}>
        <AppText variant="label" color="textSecondary">
          Previous Performance
        </AppText>
        {historySets.length > 0 ? (
          historySets.slice(0, 3).map((set, index) => (
            <AppText key={`${set.loggedAt}-${index}`} variant="footnote" color="textSecondary">
              {formatPreviousPerformanceLine(set, loggingMode, formatWeight, weightLabel, distanceUnit)}
            </AppText>
          ))
        ) : (
          <AppText variant="footnote" color="textTertiary">
            No prior sets logged
          </AppText>
        )}
      </View>

      <View style={styles.block}>
        <AppText variant="label" color="textSecondary">
          Suggested Weight
        </AppText>
        {historySets.length > 0 && loggingMode === 'weighted' && historySets[0]?.weightKg != null && historySets[0].weightKg > 0 ? (
          <AppText variant="bodyBold" color="accent">
            {formatPreviousPerformanceLine(historySets[0], loggingMode, formatWeight, weightLabel, distanceUnit)}
            {' · from last session'}
          </AppText>
        ) : (
          <AppText variant="footnote" color="textTertiary">
            Log your first set — we'll suggest weight next time
          </AppText>
        )}
      </View>

      <View style={styles.block}>
        <AppText variant="label" color="textSecondary">
          Target Performance
        </AppText>
        <AppText variant="bodyBold">{targetPerformanceLine ?? planFallback}</AppText>
      </View>
    </View>
  );
}

export function WorkoutProgressBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${clamped}%` }]} />
      </View>
      <AppText variant="caption" color="textSecondary">
        {clamped}% complete
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  metricRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  metricCell: {
    flex: 1,
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.backgroundSecondary,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  block: {
    gap: Spacing.xs,
  },
  progressWrap: {
    gap: Spacing.xs,
  },
  progressTrack: {
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: LiftFlowColors.backgroundSecondary,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.full,
    backgroundColor: LiftFlowColors.accent,
  },
});
