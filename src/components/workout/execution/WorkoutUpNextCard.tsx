import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import type { WorkoutPositionLabels } from '@/lib/workoutUpNext';

type WorkoutUpNextCardProps = {
  position: WorkoutPositionLabels;
  compact?: boolean;
  supersetActive?: boolean;
};

export function WorkoutUpNextCard({ position, compact = false, supersetActive = false }: WorkoutUpNextCardProps) {
  if (compact) {
    return (
      <View style={styles.compactBlock}>
        {supersetActive ? (
          <AppText variant="caption" color="accent">
            Superset · switch partners with no rest
          </AppText>
        ) : null}
        <View style={styles.compactRow}>
          <AppText variant="bodyBold" style={styles.compactNow}>
            {position.currentSetLabel}
          </AppText>
          <AppText variant="caption" color="textTertiary">
            →
          </AppText>
          <AppText variant="bodyBold" color="accent" style={styles.upNextCompact}>
            {position.upNextLabel}
          </AppText>
        </View>
        {!supersetActive && position.exerciseName ? (
          <AppText variant="footnote" color="textTertiary">
            {position.exerciseName}
          </AppText>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {supersetActive ? (
        <AppText variant="caption" color="accent">
          Superset — finish A, go straight to B
        </AppText>
      ) : null}
      <View style={styles.row}>
        <View style={styles.cell}>
          <AppText variant="caption" color="textSecondary">
            Now
          </AppText>
          <AppText variant="bodyBold">{position.currentSetLabel}</AppText>
          <AppText variant="footnote" color="textTertiary">
            {position.exerciseName}
          </AppText>
        </View>
        <View style={styles.divider} />
        <View style={styles.cell}>
          <AppText variant="caption" color="accent">
            Up next
          </AppText>
          <AppText variant="bodyBold" color="accent">
            {position.upNextLabel}
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: LiftFlowColors.backgroundSecondary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  compactBlock: {
    gap: Spacing.xs,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  compactNow: {
    flexShrink: 1,
  },
  upNextCompact: {
    flexShrink: 1,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  cell: {
    flex: 1,
    gap: Spacing.xs,
  },
  divider: {
    width: 1,
    backgroundColor: LiftFlowColors.border,
  },
});
