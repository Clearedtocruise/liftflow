import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { exercisesFromPlannedWorkout } from '@/lib/workoutPlan';
import type { PlannedWorkout } from '@/types/training';
import type { EditableWorkoutExercise } from '@/types/workoutExecution';

type ReplaceExerciseInput = {
  name: string;
  exerciseId?: string;
};

type WorkoutPlanDraftContextValue = {
  plannedWorkout: PlannedWorkout | null;
  exercises: EditableWorkoutExercise[];
  setPlannedWorkout: (workout: PlannedWorkout | null) => void;
  setExercises: (exercises: EditableWorkoutExercise[]) => void;
  replaceExerciseAt: (index: number, replacement: ReplaceExerciseInput) => void;
  resetDraft: () => void;
};

const WorkoutPlanDraftContext = createContext<WorkoutPlanDraftContextValue | null>(null);

export function WorkoutPlanDraftProvider({ children }: { children: ReactNode }) {
  const [plannedWorkout, setPlannedWorkoutState] = useState<PlannedWorkout | null>(null);
  const [exercises, setExercises] = useState<EditableWorkoutExercise[]>([]);

  const setPlannedWorkout = useCallback((workout: PlannedWorkout | null) => {
    setPlannedWorkoutState(workout);
    setExercises(exercisesFromPlannedWorkout(workout));
  }, []);

  const resetDraft = useCallback(() => {
    setPlannedWorkoutState(null);
    setExercises([]);
  }, []);

  const replaceExerciseAt = useCallback((index: number, replacement: ReplaceExerciseInput) => {
    setExercises((current) => {
      if (index < 0 || index >= current.length) return current;
      const previous = current[index];
      const nextExercise: EditableWorkoutExercise = {
        ...previous,
        id: `plan-${index}-${replacement.name.toLowerCase().replace(/\s+/g, '-')}`,
        name: replacement.name,
        exerciseId: replacement.exerciseId ?? previous.exerciseId,
      };
      const updated = [...current];
      updated[index] = nextExercise;
      return updated;
    });
  }, []);

  const value = useMemo(
    () => ({
      plannedWorkout,
      exercises,
      setPlannedWorkout,
      setExercises,
      replaceExerciseAt,
      resetDraft,
    }),
    [plannedWorkout, exercises, setPlannedWorkout, replaceExerciseAt, resetDraft],
  );

  return <WorkoutPlanDraftContext.Provider value={value}>{children}</WorkoutPlanDraftContext.Provider>;
}

export function useWorkoutPlanDraft(): WorkoutPlanDraftContextValue {
  const context = useContext(WorkoutPlanDraftContext);
  if (!context) {
    throw new Error('useWorkoutPlanDraft must be used within WorkoutPlanDraftProvider');
  }
  return context;
}
