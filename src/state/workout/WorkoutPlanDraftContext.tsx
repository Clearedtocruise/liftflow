import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { exercisesFromPlannedWorkout } from '@/lib/workoutPlan';
import type { PlannedWorkout } from '@/types/training';
import type { EditableWorkoutExercise } from '@/types/workoutExecution';

type WorkoutPlanDraftContextValue = {
  plannedWorkout: PlannedWorkout | null;
  exercises: EditableWorkoutExercise[];
  setPlannedWorkout: (workout: PlannedWorkout | null) => void;
  setExercises: (exercises: EditableWorkoutExercise[]) => void;
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

  const value = useMemo(
    () => ({
      plannedWorkout,
      exercises,
      setPlannedWorkout,
      setExercises,
      resetDraft,
    }),
    [plannedWorkout, exercises, setPlannedWorkout, resetDraft],
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
