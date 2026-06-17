import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import type { WorkoutPositionLabels } from '@/lib/workoutUpNext';

type WorkoutUpNextCardProps = {
  position: WorkoutPositionLabels;
  compact?: boolean;
};

export function WorkoutUpNextCard({ position, compact = false }: WorkoutUpNextCardProps) {
  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <View style={styles.row}>
        <View style={styles.cell}>
          <AppText variant="caption" color="textSecondary">
            Now
          </AppText>
          <AppText variant="bodyBold">{position.currentSetLabel}</AppText>
          {!compact ? (
            <AppText variant="footnote" color="textTertiary">
              {position.exerciseName}
            </AppText>
          ) : null}
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
  cardCompact: {
    padding: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
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
