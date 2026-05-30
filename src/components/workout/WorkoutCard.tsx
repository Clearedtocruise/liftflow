import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import type { WorkoutExercise, WorkoutSet } from '@/types/workout';

type WorkoutCardProps = {
  exercise: WorkoutExercise;
  onEditSet?: (set: WorkoutSet, exerciseName: string) => void;
};

export function WorkoutCard({ exercise, onEditSet }: WorkoutCardProps) {
  const lastSet = exercise.sets[exercise.sets.length - 1];
  const exerciseName = exercise.exercise?.name ?? 'Unknown';

  return (
    <Card accent={exercise.isActive} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <AppText variant="bodyBold">{exerciseName}</AppText>
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
            <Pressable
              key={set.id}
              style={({ pressed }) => [styles.setRow, pressed && styles.setRowPressed]}
              onPress={() => onEditSet?.(set, exerciseName)}
              accessibilityRole="button"
              accessibilityLabel={`Edit set ${set.setNumber}`}>
              <AppText variant="footnote" color="textSecondary" style={styles.setNumber}>
                Set {set.setNumber}
              </AppText>
              <AppText variant="bodyBold">
                {set.weight ?? '—'} × {set.reps ?? '—'}
              </AppText>
              {set.isPr ? (
                <View style={styles.prBadge}>
                  <AppText variant="caption" color="accent">
                    PR
                  </AppText>
                </View>
              ) : null}
              {set.type !== 'normal' ? (
                <AppText variant="caption" color="textTertiary">
                  {set.type}
                </AppText>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : (
        <AppText variant="footnote" color="textTertiary">
          No sets logged yet
        </AppText>
      )}

      {lastSet ? (
        <AppText variant="caption" color="textSecondary" style={styles.hint}>
          Suggested: {(lastSet.weight ?? 0) + 5} × 4–6 · Tap a set to edit
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
    paddingVertical: Spacing.xs,
    borderRadius: 8,
  },
  setRowPressed: {
    backgroundColor: LiftFlowColors.surfaceHighlight,
  },
  setNumber: {
    width: 48,
  },
  prBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: LiftFlowColors.accentGlow,
  },
  hint: {
    marginTop: Spacing.md,
  },
});
