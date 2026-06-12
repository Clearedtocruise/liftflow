import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import type { EditableWorkoutExercise } from '@/types/workoutExecution';

type WorkoutExerciseListProps = {
  exercises: EditableWorkoutExercise[];
  onPressExercise?: (exercise: EditableWorkoutExercise, index: number) => void;
};

export function WorkoutExerciseList({ exercises, onPressExercise }: WorkoutExerciseListProps) {
  return (
    <Card style={styles.card}>
      {exercises.map((exercise, index) => (
        <Pressable
          key={exercise.id}
          style={({ pressed }) => [styles.row, index < exercises.length - 1 && styles.rowBorder, pressed && styles.rowPressed]}
          onPress={() => onPressExercise?.(exercise, index)}
          disabled={!onPressExercise}>
          <View style={styles.indexBadge}>
            <AppText variant="caption" color="accent">
              {index + 1}
            </AppText>
          </View>
          <View style={styles.content}>
            <AppText variant="bodyBold">{exercise.name}</AppText>
            <AppText variant="caption" color="textSecondary">
              {exercise.sets} sets{exercise.repRange ? ` · ${exercise.repRange} reps` : ''}
            </AppText>
          </View>
        </Pressable>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: Spacing.sm,
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LiftFlowColors.border,
  },
  rowPressed: {
    backgroundColor: LiftFlowColors.surfaceHighlight,
    borderRadius: Radius.sm,
  },
  indexBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LiftFlowColors.accentGlow,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  content: {
    flex: 1,
    gap: Spacing.xs,
  },
});
