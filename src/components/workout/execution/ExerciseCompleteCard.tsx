import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { useUnits } from '@/hooks/useUnits';

type ExerciseCompleteCardProps = {
  volumeKg: number;
  hasPr: boolean;
  onNext: () => void;
  isLastExercise: boolean;
  autoAdvancing?: boolean;
};

export function ExerciseCompleteCard({
  volumeKg,
  hasPr,
  onNext,
  isLastExercise,
  autoAdvancing = false,
}: ExerciseCompleteCardProps) {
  const units = useUnits();

  return (
    <Card style={styles.card} glow>
      <View style={styles.badge}>
        <AppText variant="label" color="success">
          Exercise Complete
        </AppText>
      </View>
      <AppText variant="bodyBold">Volume Lifted</AppText>
      <AppText variant="metric" style={styles.metric}>
        {units.formatWeight(volumeKg)}
      </AppText>
      {hasPr ? (
        <View style={styles.prBadge}>
          <AppText variant="caption" color="accent">
            PR Achieved
          </AppText>
        </View>
      ) : null}
      {autoAdvancing ? (
        <AppText variant="footnote" color="textSecondary">
          {isLastExercise ? 'Finishing workout…' : 'Next exercise starting…'}
        </AppText>
      ) : null}
      <PrimaryButton
        label={isLastExercise ? 'Finish Workout' : 'Next Exercise'}
        onPress={onNext}
        size="large"
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  badge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(0, 229, 168, 0.12)',
  },
  metric: {
    fontSize: 32,
    lineHeight: 38,
  },
  prBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: LiftFlowColors.accentGlow,
    borderWidth: 1,
    borderColor: LiftFlowColors.accent,
  },
});
