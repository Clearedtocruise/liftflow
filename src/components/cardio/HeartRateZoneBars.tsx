import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { formatCardioDuration } from '@/lib/exerciseModality';
import type { HeartRateZoneBucket } from '@/lib/heartRateZones';

type HeartRateZoneBarsProps = {
  zones: HeartRateZoneBucket[];
};

export function HeartRateZoneBars({ zones }: HeartRateZoneBarsProps) {
  const total = zones.reduce((sum, zone) => sum + zone.seconds, 0);
  if (total <= 0) return null;

  return (
    <View style={styles.wrap}>
      <AppText variant="label" color="textSecondary" align="center">
        Heart rate zones
      </AppText>
      <View style={styles.barRow}>
        {zones.map((zone) => {
          const flex = Math.max(zone.seconds / total, zone.seconds > 0 ? 0.08 : 0.02);
          return (
            <View
              key={zone.zone}
              style={[
                styles.segment,
                {
                  flex,
                  backgroundColor: zoneColor(zone.zone),
                  opacity: zone.seconds > 0 ? 1 : 0.25,
                },
              ]}
            />
          );
        })}
      </View>
      <View style={styles.legend}>
        {zones.map((zone) => (
          <AppText key={zone.zone} variant="caption" color="textTertiary">
            Z{zone.zone} {zone.seconds > 0 ? formatCardioDuration(Math.round(zone.seconds)) : '—'}
          </AppText>
        ))}
      </View>
    </View>
  );
}

function zoneColor(zone: number): string {
  switch (zone) {
    case 1:
      return '#38BDF8';
    case 2:
      return '#34D399';
    case 3:
      return '#FBBF24';
    case 4:
      return '#F97316';
    default:
      return '#EF4444';
  }
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.sm,
    width: '100%',
  },
  barRow: {
    flexDirection: 'row',
    height: 10,
    borderRadius: Radius.full,
    overflow: 'hidden',
    backgroundColor: LiftFlowColors.backgroundSecondary,
  },
  segment: {
    height: '100%',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing.xs,
  },
});
