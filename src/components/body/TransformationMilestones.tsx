import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { formatDisplayDate } from '@/lib/transformation/transformationStory';
import type { BodyFatMilestone } from '@/types/transformation';

type TransformationMilestonesProps = {
  milestones: BodyFatMilestone[];
};

export function TransformationMilestones({ milestones }: TransformationMilestonesProps) {
  if (milestones.length === 0) return null;

  return (
    <Card style={styles.card}>
      <AppText variant="label" color="accent">
        Body fat milestones
      </AppText>
      <AppText variant="footnote" color="textSecondary">
        Estimated dates at your current pace
      </AppText>
      {milestones.map((milestone) => (
        <View key={milestone.bodyFatPct} style={styles.row}>
          <View style={styles.left}>
            <View style={[styles.dot, milestone.reached && styles.dotReached]} />
            <AppText variant="bodyBold">{milestone.bodyFatPct}%</AppText>
          </View>
          <AppText variant="footnote" color={milestone.reached ? 'success' : 'textSecondary'}>
            {milestone.reached
              ? 'Reached'
              : milestone.estimatedDate
                ? formatDisplayDate(milestone.estimatedDate)
                : '—'}
          </AppText>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.sm },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LiftFlowColors.border,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: LiftFlowColors.textTertiary,
  },
  dotReached: {
    backgroundColor: LiftFlowColors.success,
  },
});
