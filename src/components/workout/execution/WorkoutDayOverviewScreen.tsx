import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { WorkoutExerciseDetailList } from '@/components/workout/execution/WorkoutExerciseDetailList';
import { Spacing } from '@/constants/theme';
import { workoutMuscleGroups } from '@/lib/weekPlan';
import { estimateWorkoutDurationMinutes } from '@/lib/workoutPlan';
import type { PlannedWorkout } from '@/types/training';
import type { EditableWorkoutExercise } from '@/types/workoutExecution';

type WorkoutDayOverviewScreenProps = {
  workout: PlannedWorkout;
  exercises: EditableWorkoutExercise[];
  userId?: string;
  starting: boolean;
  onStart: () => void;
  onEdit: () => void;
  onBack: () => void;
};

export function WorkoutDayOverviewScreen({
  workout,
  exercises,
  userId,
  starting,
  onStart,
  onEdit,
  onBack,
}: WorkoutDayOverviewScreenProps) {
  const durationMin = estimateWorkoutDurationMinutes(exercises);

  return (
    <ScreenContainer contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} hitSlop={8}>
        <AppText variant="footnote" color="accent">
          ← Weekly Plan
        </AppText>
      </Pressable>

      <Card style={styles.summary}>
        <AppText variant="title">{workout.name}</AppText>
        <AppText variant="footnote" color="textSecondary">
          {workoutMuscleGroups(workout)} · {exercises.length} exercises · ~{durationMin} min
        </AppText>
      </Card>

      <AppText variant="label" color="textSecondary">
        Exercises
      </AppText>
      <WorkoutExerciseDetailList exercises={exercises} userId={userId} />

      <View style={styles.actions}>
        <PrimaryButton label={starting ? 'Starting…' : 'Start Workout'} size="large" loading={starting} onPress={onStart} />
        <PrimaryButton label="Edit Workout" variant="secondary" onPress={onEdit} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.lg,
    paddingBottom: Spacing.huge,
  },
  summary: {
    gap: Spacing.sm,
  },
  actions: {
    gap: Spacing.sm,
  },
});
