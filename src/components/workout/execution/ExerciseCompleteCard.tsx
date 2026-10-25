import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { useUnits, type UnitsFormatter } from '@/hooks/useUnits';
import { formatWorkDuration, type ExerciseWork } from '@/lib/exerciseWorkSummary';

type ExerciseCompleteCardProps = {
  work: ExerciseWork;
  hasPr: boolean;
  onNext: () => void;
  isLastExercise: boolean;
  autoAdvancing?: boolean;
};

function workLines(work: ExerciseWork, units: UnitsFormatter): { title: string; metric: string; detail?: string } {
  const setsText = `${work.sets} ${work.sets === 1 ? 'set' : 'sets'}`;
  switch (work.kind) {
    case 'time':
      return { title: 'Time Completed', metric: formatWorkDuration(work.seconds), detail: setsText };
    case 'cardio':
      return {
        title: 'Work Completed',
        metric: formatWorkDuration(work.seconds),
        detail: work.meters > 0 ? `${units.formatDistance(work.meters / 1000)} · ${setsText}` : setsText,
      };
    case 'reps':
      return {
        title: 'Reps Completed',
        metric: String(work.reps),
        detail:
          work.volumeKg > 0 ? `${setsText} · ${units.formatWeight(work.volumeKg)} moved at your body weight` : setsText,
      };
    default:
      return { title: 'Volume Lifted', metric: units.formatWeight(work.volumeKg), detail: `${work.reps} reps · ${setsText}` };
  }
}

export function ExerciseCompleteCard({
  work,
  hasPr,
  onNext,
  isLastExercise,
  autoAdvancing = false,
}: ExerciseCompleteCardProps) {
  const units = useUnits();
  const lines = workLines(work, units);

  return (
    <Card style={styles.card} glow>
      <View style={styles.badge}>
        <AppText variant="label" color="success">
          Exercise Complete
        </AppText>
      </View>
      <AppText variant="bodyBold">{lines.title}</AppText>
      <AppText variant="metric" style={styles.metric}>
        {lines.metric}
      </AppText>
      {lines.detail ? (
        <AppText variant="footnote" color="textSecondary">
          {lines.detail}
        </AppText>
      ) : null}
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
