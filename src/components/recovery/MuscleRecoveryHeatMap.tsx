import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { muscleScoreColor } from '@/lib/recoveryIntelligenceEngine';
import type { MuscleRecoveryState } from '@/types/recoveryIntelligence';

type MuscleRecoveryHeatMapProps = {
  muscles: MuscleRecoveryState[];
};

export function MuscleRecoveryHeatMap({ muscles }: MuscleRecoveryHeatMapProps) {
  return (
    <View style={styles.grid}>
      {muscles.map((muscle) => {
        const colorKey = muscleScoreColor(muscle.score);
        const bg =
          colorKey === 'success'
            ? 'rgba(0, 229, 168, 0.12)'
            : colorKey === 'accent'
              ? LiftFlowColors.accentGlow
              : colorKey === 'restTimer'
                ? LiftFlowColors.restTimerMuted
                : LiftFlowColors.surfaceHighlight;

        return (
          <View key={muscle.muscle} style={[styles.cell, { backgroundColor: bg }]}>
            <AppText variant="caption" color="textSecondary">
              {muscle.label}
            </AppText>
            <AppText variant="bodyBold" color={colorKey}>
              {muscle.score}
            </AppText>
            <AppText variant="caption" color="textTertiary">
              {muscle.hoursSinceTraining != null ? `${muscle.hoursSinceTraining}h ago` : 'Fresh'}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  cell: {
    width: '47%',
    borderRadius: 12,
    padding: Spacing.md,
    gap: Spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.border,
  },
});
