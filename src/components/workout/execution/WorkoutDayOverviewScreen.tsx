import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ExerciseMusclePanel } from '@/components/exercise/ExerciseMusclePanel';
import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { ExercisePickerModal } from '@/components/workout/execution/ExercisePickerModal';
import { ExerciseReplaceSheet } from '@/components/workout/execution/ExerciseReplaceSheet';
import { WorkoutExerciseDetailList } from '@/components/workout/execution/WorkoutExerciseDetailList';
import { Spacing } from '@/constants/theme';
import { aggregateWorkoutMuscles } from '@/lib/exerciseMuscleMap';
import { workoutMuscleGroups } from '@/lib/weekPlan';
import { estimateWorkoutDurationMinutes } from '@/lib/workoutPlan';
import type { ExerciseAlternativeOption } from '@/services/exerciseAdvisoryService';
import type { Exercise } from '@/types';
import type { PlannedWorkout } from '@/types/training';
import type { EditableWorkoutExercise } from '@/types/workoutExecution';
import { WORKOUT_EXECUTION_MODE_LABELS } from '@/types/workoutExecutionMode';

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
  onAddExercise?: (exercise: Exercise) => void | Promise<void>;
};

/** iOS presents one modal at a time, so the sheets here are a single choice rather than two flags. */
type OverviewSheet = { kind: 'none' } | { kind: 'add' } | { kind: 'replace'; index: number };

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
  onAddExercise,
}: WorkoutDayOverviewScreenProps) {
  const durationMin = estimateWorkoutDurationMinutes(exercises);
  const mode = workout.metadata?.executionMode;
  const executionModeLabel = mode ? (WORKOUT_EXECUTION_MODE_LABELS[mode] ?? null) : null;
  const sessionMuscles = aggregateWorkoutMuscles(exercises.map((item) => item.name));
  const [sheet, setSheet] = useState<OverviewSheet>({ kind: 'none' });
  const replaceIndex = sheet.kind === 'replace' ? sheet.index : null;
  const replaceExercise = replaceIndex != null ? exercises[replaceIndex] ?? null : null;
  const closeSheet = () => setSheet({ kind: 'none' });

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
          {executionModeLabel ? ` · ${executionModeLabel}` : ''}
        </AppText>
      </Card>

      <Card style={styles.figureCard}>
        <View style={styles.figureHeader}>
          <AppText variant="bodyBold">Today&apos;s Workout Muscles</AppText>
          <AppText variant="footnote" color="textSecondary">
            These are all primary and secondary muscle groups targeted during today&apos;s workout.
          </AppText>
        </View>
        <ExerciseMusclePanel
          exerciseName={workout.name}
          gender={gender}
          variant="hero"
          profile={sessionMuscles}
        />
      </Card>

      <View style={styles.exercisesHeader}>
        <AppText variant="bodyBold">Exercises</AppText>
        <AppText variant="footnote" color="textSecondary">
          Each exercise shows the muscles it targets.
        </AppText>
      </View>
      <WorkoutExerciseDetailList
        exercises={exercises}
        userId={userId}
        gender={gender}
        onReplaceExercise={onReplaceExercise ? (_, exercise) => {
          const index = exercises.findIndex((item) => item.id === exercise.id);
          if (index >= 0) setSheet({ kind: 'replace', index });
        } : undefined}
      />

      {onAddExercise ? (
        <PrimaryButton
          label="+ Add Exercise"
          variant="secondary"
          onPress={() => setSheet({ kind: 'add' })}
        />
      ) : null}

      <View style={styles.actions}>
        <PrimaryButton label={starting ? 'Starting…' : 'Start Workout'} size="large" loading={starting} onPress={onStart} />
        <PrimaryButton label="Edit Workout" variant="secondary" onPress={onEdit} />
      </View>

      {onReplaceExercise ? (
        <ExerciseReplaceSheet
          visible={sheet.kind === 'replace'}
          exercise={replaceExercise}
          userId={userId}
          goal={goal}
          programType={programType}
          availableEquipment={availableEquipment}
          onClose={closeSheet}
          onReplace={(option) => {
            if (replaceIndex == null) return;
            void onReplaceExercise(replaceIndex, option);
            closeSheet();
          }}
        />
      ) : null}

      {onAddExercise ? (
        <ExercisePickerModal
          visible={sheet.kind === 'add'}
          onClose={closeSheet}
          onSelect={(picked) => void onAddExercise(picked)}
          title="Add Exercise"
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
    gap: Spacing.md,
    alignItems: 'stretch',
  },
  figureHeader: {
    gap: Spacing.xs,
  },
  exercisesHeader: {
    gap: Spacing.xs,
  },
  actions: {
    gap: Spacing.sm,
  },
});
