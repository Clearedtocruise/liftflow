import { StyleSheet, TextInput, View } from 'react-native';

import { HeartRateZoneBars } from '@/components/cardio/HeartRateZoneBars';
import { GradientBorderCard } from '@/components/layout/GradientBorderCard';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { formatCalorieEstimate } from '@/lib/activityCalories';
import { formatCardioDuration } from '@/lib/exerciseModality';
import type { HeartRateZoneBucket } from '@/lib/heartRateZones';
import { supportsPowerMetrics } from '@/lib/heartRateZones';

type ActivitySessionSaveCardProps = {
  activityLabel: string;
  durationSeconds: number;
  distanceLabel?: string;
  paceLabel?: string | null;
  speedLabel?: string | null;
  estimatedCalories: number;
  usedDefaultWeight: boolean;
  heartRateBpm?: number;
  heartRateZones?: HeartRateZoneBucket[];
  powerWatts?: number | null;
  saving?: boolean;
  showDistanceEdit?: boolean;
  distanceText?: string;
  distanceUnitLabel?: string;
  onDistanceChange?: (value: string) => void;
  onSave: () => void;
  onDiscard?: () => void;
};

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryMetric}>
      <AppText variant="label" color="textTertiary">
        {label}
      </AppText>
      <AppText variant="bodyBold">{value}</AppText>
    </View>
  );
}

export function ActivitySessionSaveCard({
  activityLabel,
  durationSeconds,
  distanceLabel,
  paceLabel,
  speedLabel,
  estimatedCalories,
  usedDefaultWeight,
  heartRateBpm,
  heartRateZones,
  powerWatts,
  saving,
  showDistanceEdit,
  distanceText,
  distanceUnitLabel,
  onDistanceChange,
  onSave,
  onDiscard,
}: ActivitySessionSaveCardProps) {
  const showPower = supportsPowerMetrics(activityLabel) && powerWatts != null && powerWatts > 0;

  return (
    <GradientBorderCard intensity="bold" innerStyle={styles.card}>
      <AppText variant="label" color="success" align="center">
        Session complete
      </AppText>
      <AppText variant="headline" align="center">
        {activityLabel}
      </AppText>

      <View style={styles.summaryRow}>
        <SummaryMetric label="Time" value={formatCardioDuration(durationSeconds)} />
        {distanceLabel ? <SummaryMetric label="Distance" value={distanceLabel} /> : null}
        {paceLabel ? <SummaryMetric label="Pace" value={paceLabel} /> : null}
        {speedLabel ? <SummaryMetric label="Speed" value={speedLabel} /> : null}
        <SummaryMetric label="Active cal" value={`~${estimatedCalories}`} />
        {heartRateBpm ? <SummaryMetric label="Heart rate" value={`${heartRateBpm} bpm`} /> : null}
        {showPower ? (
          <SummaryMetric label="Power" value={`${Math.round(powerWatts ?? 0)} W`} />
        ) : null}
      </View>

      {heartRateZones && heartRateZones.some((zone) => zone.seconds > 0) ? (
        <HeartRateZoneBars zones={heartRateZones} />
      ) : null}

      <AppText variant="label" color="accent" align="center">
        {formatCalorieEstimate(estimatedCalories, usedDefaultWeight)}
      </AppText>

      {showDistanceEdit ? (
        <View style={styles.distanceBlock}>
          <AppText variant="caption" color="textSecondary">
            Distance ({distanceUnitLabel ?? 'mi'}, optional)
          </AppText>
          <TextInput
            style={styles.distanceInput}
            value={distanceText}
            onChangeText={onDistanceChange}
            keyboardType="decimal-pad"
            placeholder={`0.0 ${distanceUnitLabel ?? 'mi'}`}
            placeholderTextColor={LiftFlowColors.textTertiary}
          />
        </View>
      ) : null}

      <PrimaryButton label="Save activity" onPress={onSave} loading={saving} size="large" />
      {onDiscard ? (
        <PrimaryButton label="Discard" variant="ghost" onPress={onDiscard} disabled={saving} />
      ) : null}
    </GradientBorderCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    justifyContent: 'center',
  },
  summaryMetric: {
    alignItems: 'center',
    gap: Spacing.xs,
    minWidth: 72,
  },
  distanceBlock: {
    gap: Spacing.xs,
  },
  distanceInput: {
    backgroundColor: LiftFlowColors.backgroundSecondary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    padding: Spacing.md,
    color: LiftFlowColors.textPrimary,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
});
