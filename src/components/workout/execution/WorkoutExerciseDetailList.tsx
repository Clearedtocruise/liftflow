import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import type { EditableWorkoutExercise } from '@/types/workoutExecution';

type WorkoutExerciseDetailListProps = {
  exercises: EditableWorkoutExercise[];
};

function formatRest(seconds?: number): string {
  if (!seconds) return '90 sec';
  if (seconds >= 60) return `${Math.round(seconds / 60)} min`;
  return `${seconds} sec`;
}

export function WorkoutExerciseDetailList({ exercises }: WorkoutExerciseDetailListProps) {
  return (
    <Card style={styles.card}>
      {exercises.map((exercise, index) => (
        <View key={exercise.id} style={[styles.row, index < exercises.length - 1 && styles.rowBorder]}>
          <AppText variant="caption" color="textTertiary" style={styles.index}>
            {index + 1}
          </AppText>
          <View style={styles.content}>
            <AppText variant="bodyBold">{exercise.name}</AppText>
            <AppText variant="footnote" color="textSecondary">
              {exercise.sets} sets · {exercise.repRange ?? '8-10'} reps · Rest {formatRest(exercise.restSeconds ?? 90)}
            </AppText>
          </View>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: Spacing.xs,
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LiftFlowColors.border,
  },
  index: {
    width: 18,
    marginTop: 2,
  },
  content: {
    flex: 1,
    gap: Spacing.xs,
  },
});
