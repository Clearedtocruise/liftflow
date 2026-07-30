import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { formatPlanTargetPerformance, formatPreviousPerformanceLine } from '@/lib/activeWorkoutMetrics';
import type { ExerciseLoggingMode } from '@/lib/exerciseModality';
import type { DistanceUnit } from '@/types/common';
import type { ExerciseHistorySet } from '@/types/workoutExecution';

type SessionSetSummary = {
  weightKg?: number;
  reps?: number;
  durationSeconds?: number;
  distanceMeters?: number;
};

type GuidedWorkoutMetricsProps = {
  currentSet: number;
  targetSets: number;
  remainingSets: number;
  loggingMode: ExerciseLoggingMode;
  repRange: string;
  /** Prior workouts only — not the sets logged earlier in this session. */
  historySets: ExerciseHistorySet[];
  /** Sets already logged on this exercise in the active workout (supersets included). */
  sessionSets?: SessionSetSummary[];
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
  sessionSets = [],
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

  const lastSessionSet = [...sessionSets]
    .reverse()
    .find((set) => (set.weightKg ?? 0) > 0 || (set.reps ?? 0) > 0);
  const historySet = historySets[0];

  let suggestedLine: string | null = null;
  let suggestedSource: string | null = null;
  if (loggingMode === 'weighted') {
    if (lastSessionSet?.weightKg != null && lastSessionSet.weightKg > 0) {
      suggestedLine = formatPreviousPerformanceLine(
        lastSessionSet,
        loggingMode,
        formatWeight,
        weightLabel,
        distanceUnit,
      );
      suggestedSource = 'from this session';
    } else if (historySet?.weightKg != null && historySet.weightKg > 0) {
      suggestedLine = formatPreviousPerformanceLine(
        historySet,
        loggingMode,
        formatWeight,
        weightLabel,
        distanceUnit,
      );
      suggestedSource = 'from last session';
    } else if (fallbackWeightKg != null && fallbackWeightKg > 0) {
      suggestedLine = `${formatWeight(fallbackWeightKg)} ${weightLabel}`;
      suggestedSource = 'from plan';
    }
  }

  // Never tell someone on set 2+ to "log your first set."
  const showFirstSetHint =
    loggingMode === 'weighted' &&
    suggestedLine == null &&
    currentSet <= 1 &&
    sessionSets.length === 0 &&
    historySets.length === 0;

  return (
    <View style={styles.container}>
      <View style={styles.metricRow}>
        <View style={styles.metricCell}>
          <AppText variant="caption" color="textSecondary">
            Current set
          </AppText>
          <AppText variant="bodyBold">
            {Math.min(currentSet, targetSets)} of {targetSets}
          </AppText>
        </View>
        <View style={styles.metricCell}>
          <AppText variant="caption" color="textSecondary">
            Sets left
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
        ) : sessionSets.length > 0 ? (
          sessionSets
            .slice(-3)
            .reverse()
            .map((set, index) => (
              <AppText key={`session-${index}`} variant="footnote" color="textSecondary">
                {formatPreviousPerformanceLine(set, loggingMode, formatWeight, weightLabel, distanceUnit)}
                {' · this session'}
              </AppText>
            ))
        ) : (
          <AppText variant="footnote" color="textTertiary">
            No prior sessions for this exercise
          </AppText>
        )}
      </View>

      <View style={styles.block}>
        <AppText variant="label" color="textSecondary">
          Suggested Weight
        </AppText>
        {suggestedLine ? (
          <AppText variant="bodyBold" color="accent">
            {suggestedLine}
            {suggestedSource ? ` · ${suggestedSource}` : ''}
          </AppText>
        ) : showFirstSetHint ? (
          <AppText variant="footnote" color="textTertiary">
            Enter a weight for set 1 — we will remember it
          </AppText>
        ) : (
          <AppText variant="footnote" color="textTertiary">
            Use the weight field below
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
