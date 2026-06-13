import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';

type TransformationProgressTimelineProps = {
  progressPercent: number;
  startLabel?: string;
  currentLabel?: string;
  goalLabel?: string;
};

export function TransformationProgressTimeline({
  progressPercent,
  startLabel = 'Start',
  currentLabel = 'Current',
  goalLabel = 'Goal',
}: TransformationProgressTimelineProps) {
  const clamped = Math.min(100, Math.max(0, progressPercent));

  return (
    <Card style={styles.card}>
      <AppText variant="label" color="accent">
        Journey timeline
      </AppText>
      <View style={styles.labels}>
        <AppText variant="caption" color="textTertiary">
          {startLabel}
        </AppText>
        <AppText variant="caption" color="accent">
          {currentLabel}
        </AppText>
        <AppText variant="caption" color="textTertiary">
          {goalLabel}
        </AppText>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${clamped}%` }]} />
        <View style={[styles.marker, { left: `${clamped}%` }]}>
          <View style={styles.markerDot} />
        </View>
      </View>
      <AppText variant="footnote" color="textSecondary" align="center">
        {clamped}% complete
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.md },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  track: {
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: LiftFlowColors.surfaceHighlight,
    overflow: 'visible',
    position: 'relative',
  },
  fill: {
    height: '100%',
    borderRadius: Radius.full,
    backgroundColor: LiftFlowColors.accent,
  },
  marker: {
    position: 'absolute',
    top: -6,
    marginLeft: -8,
  },
  markerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: LiftFlowColors.accent,
    borderWidth: 2,
    borderColor: LiftFlowColors.textPrimary,
  },
});
