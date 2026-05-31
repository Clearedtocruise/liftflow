import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import type { TransformationProjection } from '@/types/transformation';

type TransformationTimelineProps = {
  history: TransformationProjection[];
  formatWeight: (kg: number) => string;
};

export function TransformationTimeline({ history, formatWeight }: TransformationTimelineProps) {
  if (history.length === 0) {
    return (
      <Card style={styles.empty}>
        <AppText variant="body" color="textSecondary">
          Run a projection to see your transformation timeline.
        </AppText>
      </Card>
    );
  }

  return (
    <View style={styles.wrap}>
      {history.map((run, index) => (
        <View key={run.id} style={styles.row}>
          <View style={styles.dotCol}>
            <View style={[styles.dot, index === 0 && styles.dotActive]} />
            {index < history.length - 1 ? <View style={styles.line} /> : null}
          </View>
          <Card style={styles.card}>
            <AppText variant="caption" color="textSecondary">
              {new Date(run.createdAt).toLocaleDateString()}
            </AppText>
            <AppText variant="bodyBold">
              Target {run.targetBodyFatPct}% · {formatWeight(run.projected.weightKg)}
            </AppText>
            <AppText variant="footnote" color="textTertiary" numberOfLines={2}>
              {run.rationale}
            </AppText>
          </Card>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm, marginBottom: Spacing.lg },
  empty: { marginBottom: Spacing.lg },
  row: { flexDirection: 'row', gap: Spacing.md },
  dotCol: { alignItems: 'center', width: 16, paddingTop: Spacing.md },
  dot: {
    width: 10,
    height: 10,
    borderRadius: Radius.full,
    backgroundColor: LiftFlowColors.border,
  },
  dotActive: { backgroundColor: LiftFlowColors.accent },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: LiftFlowColors.border,
    marginTop: Spacing.xs,
  },
  card: { flex: 1, gap: Spacing.xs },
});
