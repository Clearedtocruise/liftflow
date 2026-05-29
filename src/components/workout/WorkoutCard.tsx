import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import type { WorkoutExercise } from '@/types/workout';

type WorkoutCardProps = {
  exercise: WorkoutExercise;
};

export function WorkoutCard({ exercise }: WorkoutCardProps) {
  const lastSet = exercise.sets[exercise.sets.length - 1];

  return (
    <Card accent={exercise.isActive} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <AppText variant="bodyBold">{exercise.exercise?.name ?? 'Unknown'}</AppText>
          <AppText variant="caption" color="textSecondary">
            {exercise.exercise?.equipment ?? ''} · {exercise.exercise?.category ?? ''}
          </AppText>
        </View>
        {exercise.isActive ? (
          <View style={styles.activeBadge}>
            <AppText variant="caption" color="accent">
              Active
            </AppText>
          </View>
        ) : null}
      </View>

      {exercise.sets.length > 0 ? (
        <View style={styles.setsContainer}>
          {exercise.sets.map((set) => (
            <View key={set.id} style={styles.setRow}>
              <AppText variant="footnote" color="textSecondary" style={styles.setNumber}>
                Set {set.setNumber}
              </AppText>
              <AppText variant="bodyBold">
                {set.weight} × {set.reps}
              </AppText>
              {set.type !== 'normal' ? (
                <AppText variant="caption" color="textTertiary">
                  {set.type}
                </AppText>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <AppText variant="footnote" color="textTertiary">
          No sets logged yet
        </AppText>
      )}

      {lastSet ? (
        <AppText variant="caption" color="textSecondary" style={styles.hint}>
          Suggested: {(lastSet.weight ?? 0) + 5} × 4–6
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  titleBlock: {
    flex: 1,
    gap: Spacing.xs,
  },
  activeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 999,
    backgroundColor: LiftFlowColors.accentGlow,
  },
  setsContainer: {
    gap: Spacing.sm,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  setNumber: {
    width: 48,
  },
  hint: {
    marginTop: Spacing.md,
  },
});
