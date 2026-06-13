import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ExerciseMusclePanel } from '@/components/exercise/ExerciseMusclePanel';
import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { ExerciseReplaceSheet } from '@/components/workout/execution/ExerciseReplaceSheet';
import { WorkoutExerciseDetailList } from '@/components/workout/execution/WorkoutExerciseDetailList';
import { Spacing } from '@/constants/theme';
import { aggregateWorkoutMuscles } from '@/lib/exerciseMuscleMap';
import { workoutMuscleGroups } from '@/lib/weekPlan';
import { estimateWorkoutDurationMinutes } from '@/lib/workoutPlan';
import type { ExerciseAlternativeOption } from '@/services/exerciseAdvisoryService';
import type { PlannedWorkout } from '@/types/training';
import type { EditableWorkoutExercise } from '@/types/workoutExecution';

type WorkoutDayOverviewScreenProps = {
  workout: PlannedWorkout;
  exercises: EditableWorkoutExercise[];
  userId?: string;
  goal?: string;
  programType?: string;
  availableEquipment?: string[];
  gender?: 'male' | 'female';
  starting: boolean;
  onStart: () => void;
  onEdit: () => void;
  onBack: () => void;
  onReplaceExercise?: (index: number, option: ExerciseAlternativeOption) => void | Promise<void>;
};

export function WorkoutDayOverviewScreen({
  workout,
  exercises,
  userId,
  goal,
  programType,
  availableEquipment,
  gender = 'male',
  starting,
  onStart,
  onEdit,
  onBack,
  onReplaceExercise,
}: WorkoutDayOverviewScreenProps) {
  const durationMin = estimateWorkoutDurationMinutes(exercises);
  const sessionMuscles = aggregateWorkoutMuscles(exercises.map((item) => item.name));
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const replaceExercise = replaceIndex != null ? exercises[replaceIndex] ?? null : null;

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
          {workout.metadata?.executionMode ? ` · ${workout.metadata.executionMode}` : ''}
        </AppText>
      </Card>

      <Card style={styles.figureCard}>
        <AppText variant="label" color="textSecondary">
          Muscles trained
        </AppText>
        <ExerciseMusclePanel
          exerciseName={workout.name}
          gender={gender}
          variant="hero"
          profile={sessionMuscles}
        />
      </Card>

      <AppText variant="label" color="textSecondary">
        Exercises
      </AppText>
      <WorkoutExerciseDetailList
        exercises={exercises}
        userId={userId}
        gender={gender}
        onReplaceExercise={onReplaceExercise ? (_, exercise) => {
          const index = exercises.findIndex((item) => item.id === exercise.id);
          if (index >= 0) setReplaceIndex(index);
        } : undefined}
      />

      <View style={styles.actions}>
        <PrimaryButton label={starting ? 'Starting…' : 'Start Workout'} size="large" loading={starting} onPress={onStart} />
        <PrimaryButton label="Edit Workout" variant="secondary" onPress={onEdit} />
      </View>

      {onReplaceExercise ? (
        <ExerciseReplaceSheet
          visible={replaceIndex != null}
          exercise={replaceExercise}
          userId={userId}
          goal={goal}
          programType={programType}
          availableEquipment={availableEquipment}
          onClose={() => setReplaceIndex(null)}
          onReplace={(option) => {
            if (replaceIndex == null) return;
            void onReplaceExercise(replaceIndex, option);
            setReplaceIndex(null);
          }}
          onManualSearch={onEdit}
        />
      ) : null}
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
  figureCard: {
    gap: Spacing.sm,
    alignItems: 'center',
  },
  actions: {
    gap: Spacing.sm,
  },
});
