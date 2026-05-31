import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import type { RecoveryIntelligenceTrendPoint } from '@/types/recoveryIntelligence';

type RecoveryTrendChartProps = {
  trend: RecoveryIntelligenceTrendPoint[];
  title?: string;
};

function barColor(score: number): string {
  if (score < 40) return LiftFlowColors.restTimer;
  if (score < 60) return LiftFlowColors.textTertiary;
  if (score < 85) return LiftFlowColors.accent;
  return LiftFlowColors.success;
}

export function RecoveryTrendChart({ trend, title = '14-Day Trend' }: RecoveryTrendChartProps) {
  const points = trend.slice(-14);

  if (points.length < 2) {
    return (
      <AppText variant="footnote" color="textTertiary">
        Complete check-ins to see your recovery trend.
      </AppText>
    );
  }

  return (
    <View style={styles.wrap}>
      <AppText variant="caption" color="textSecondary">
        {title}
      </AppText>
      <View style={styles.row}>
        {points.map((point) => (
          <View key={point.date} style={styles.barWrap}>
            <AppText variant="caption" color="textTertiary" style={styles.scoreLabel}>
              {point.score}
            </AppText>
            <View
              style={[
                styles.bar,
                {
                  height: Math.max(10, (point.score / 100) * 56),
                  backgroundColor: barColor(point.score),
                },
              ]}
            />
            <AppText variant="caption" color="textTertiary" style={styles.dateLabel}>
              {point.date.slice(5)}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.xs,
    minHeight: 72,
  },
  barWrap: { flex: 1, alignItems: 'center', gap: 2 },
  bar: { width: '100%', borderRadius: 4, minHeight: 10 },
  dateLabel: { fontSize: 9 },
  scoreLabel: { fontSize: 9 },
});
