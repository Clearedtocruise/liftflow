import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import type { CardioGpsStatus } from '@/hooks/useCardioLocationTracking';
import { formatCalorieEstimate } from '@/lib/activityCalories';

type SteadyCardioMetricsProps = {
  distanceLabel: string;
  paceLabel: string | null;
  speedLabel: string | null;
  calories: number;
  usedDefaultWeight: boolean;
  heartRateBpm?: number;
  gpsStatus?: CardioGpsStatus;
  compact?: boolean;
};

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCell}>
      <AppText variant="caption" color="textSecondary" align="center">
        {label}
      </AppText>
      <AppText variant="bodyBold" align="center">
        {value}
      </AppText>
    </View>
  );
}

function gpsStatusHint(status: CardioGpsStatus | undefined): string | null {
  switch (status) {
    case 'starting':
      return 'Acquiring GPS…';
    case 'tracking':
      return 'GPS tracking distance';
    case 'denied':
      return 'Location off — enter distance manually when you finish';
    case 'unavailable':
      return 'GPS unavailable — enter distance manually when you finish';
    default:
      return null;
  }
}

export function SteadyCardioMetrics({
  distanceLabel,
  paceLabel,
  speedLabel,
  calories,
  usedDefaultWeight,
  heartRateBpm,
  gpsStatus,
  compact = false,
}: SteadyCardioMetricsProps) {
  const hint = gpsStatusHint(gpsStatus);

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={styles.metricRow}>
        <MetricCell label="Distance" value={distanceLabel} />
        <MetricCell label="Pace" value={paceLabel ?? '—'} />
      </View>
      <View style={styles.metricRow}>
        <MetricCell label="Calories" value={`~${calories}`} />
        <MetricCell label="Heart rate" value={heartRateBpm ? `${heartRateBpm} bpm` : '—'} />
      </View>
      {!compact && speedLabel ? (
        <View style={styles.metricRow}>
          <MetricCell label="Speed" value={speedLabel} />
        </View>
      ) : null}
      {hint ? (
        <AppText variant="footnote" color="textTertiary" align="center">
          {hint}
        </AppText>
      ) : null}
      <AppText variant="footnote" color="textTertiary" align="center">
        {formatCalorieEstimate(calories, usedDefaultWeight)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.backgroundSecondary,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  containerCompact: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 0,
  },
  metricRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  metricCell: {
    flex: 1,
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
});
