import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { formatPlanTargetPerformance, formatPreviousPerformanceLine } from '@/lib/activeWorkoutMetrics';
import type { ExerciseLoggingMode } from '@/lib/exerciseModality';
import type { DistanceUnit } from '@/types/common';
import type { ExerciseHistorySet } from '@/types/workoutExecution';

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
  /** Minimal layout — one target line + optional last-session hint. */
  compact?: boolean;
  /** When true, target line is shown elsewhere (e.g. coach card). */
  hideTarget?: boolean;
};

export function GuidedWorkoutMetrics({
  targetSets,
  loggingMode,
  repRange,
  historySets,
  targetPerformanceLine,
  formatWeight,
  weightLabel,
  distanceUnit,
  fallbackWeightKg,
  compact = false,
  hideTarget = false,
}: GuidedWorkoutMetricsProps) {
  const planFallback = formatPlanTargetPerformance(
    loggingMode,
    targetSets,
    repRange,
    formatWeight,
    weightLabel,
    fallbackWeightKg,
  );
  const targetLine = targetPerformanceLine ?? planFallback;
  const lastLine =
    historySets.length > 0
      ? formatPreviousPerformanceLine(historySets[0], loggingMode, formatWeight, weightLabel, distanceUnit)
      : null;

  if (compact) {
    if (hideTarget && !lastLine) return null;

    return (
      <View style={styles.compact}>
        {!hideTarget ? (
          <AppText variant="bodyBold" color="accent">
            {targetLine}
          </AppText>
        ) : null}
        {lastLine ? (
          <AppText variant="footnote" color="textTertiary">
            Last · {lastLine}
          </AppText>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
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

      {!hideTarget ? (
        <View style={styles.block}>
          <AppText variant="label" color="textSecondary">
            Target Performance
          </AppText>
          <AppText variant="bodyBold">{targetLine}</AppText>
        </View>
      ) : null}
    </View>
  );
}

export function WorkoutProgressBar({ percent, compact = false }: { percent: number; compact?: boolean }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${clamped}%` }]} />
      </View>
      {!compact ? (
        <AppText variant="caption" color="textSecondary">
          {clamped}% complete
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  compact: {
    gap: Spacing.xs,
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
