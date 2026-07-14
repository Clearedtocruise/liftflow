import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import {
    metricLabel,
    metricValue,
    type ExerciseProgressMetric,
    type ExerciseProgressPoint,
} from '@/lib/exerciseProgress';

type ExerciseProgressChartProps = {
  points: ExerciseProgressPoint[];
  metric: ExerciseProgressMetric;
  weightLabel: string;
  formatValue: (value: number) => string;
  onSelectMetric?: (metric: ExerciseProgressMetric) => void;
  availableMetrics?: ExerciseProgressMetric[];
};

export function ExerciseProgressChart({
  points,
  metric,
  weightLabel,
  formatValue,
  onSelectMetric,
  availableMetrics = ['estimated_1rm', 'best_weight', 'volume'],
}: ExerciseProgressChartProps) {
  if (points.length === 0) {
    return (
      <AppText variant="footnote" color="textTertiary">
        Log a few weighted sets to unlock this chart.
      </AppText>
    );
  }

  const values = points.map((p) => metricValue(p, metric));
  const max = Math.max(...values, 1);

  return (
    <View style={styles.wrap}>
      {onSelectMetric && availableMetrics.length > 1 ? (
        <View style={styles.metricRow}>
          {availableMetrics.map((option) => (
            <Pressable
              key={option}
              onPress={() => onSelectMetric(option)}
              style={[styles.metricChip, metric === option && styles.metricChipActive]}>
              <AppText variant="caption" color={metric === option ? 'accent' : 'textSecondary'}>
                {shortMetricName(option)}
              </AppText>
            </Pressable>
          ))}
        </View>
      ) : (
        <AppText variant="caption" color="textSecondary">
          {metricLabel(metric, weightLabel)}
        </AppText>
      )}

      <View style={styles.row}>
        {points.map((point, index) => {
          const value = values[index] ?? 0;
          const height = Math.max(8, (value / max) * 88);
          return (
            <View key={point.date} style={styles.barWrap}>
              <AppText variant="caption" color="textTertiary" style={styles.valueLabel}>
                {value > 0 ? formatValue(value) : '—'}
              </AppText>
              <View
                style={[
                  styles.bar,
                  {
                    height,
                    backgroundColor: value > 0 ? LiftFlowColors.accent : LiftFlowColors.border,
                  },
                ]}
              />
              <AppText variant="caption" color="textTertiary" style={styles.dateLabel}>
                {point.date.slice(5)}
              </AppText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function shortMetricName(metric: ExerciseProgressMetric): string {
  switch (metric) {
    case 'estimated_1rm':
      return 'Est. 1RM';
    case 'best_weight':
      return 'Best wt';
    case 'volume':
      return 'Volume';
    case 'best_reps':
      return 'Reps';
    default:
      return 'Metric';
  }
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  metricChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    backgroundColor: LiftFlowColors.backgroundSecondary,
  },
  metricChipActive: {
    borderColor: LiftFlowColors.accent,
    backgroundColor: LiftFlowColors.primaryGlow,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.xs,
    minHeight: 110,
  },
  barWrap: { flex: 1, alignItems: 'center', gap: 2 },
  bar: { width: '100%', borderRadius: 4, minHeight: 8 },
  dateLabel: { fontSize: 9 },
  valueLabel: { fontSize: 9 },
});
