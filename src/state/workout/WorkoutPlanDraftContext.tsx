import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { exercisesFromPlannedWorkout, remapExercisesForExecutionMode } from '@/lib/workoutPlan';
import type { PlannedWorkout } from '@/types/training';
import type { EditableWorkoutExercise } from '@/types/workoutExecution';

type ReplaceExerciseInput = {
  name: string;
  exerciseId?: string;
};

type WorkoutPlanDraftContextValue = {
  plannedWorkout: PlannedWorkout | null;
  exercises: EditableWorkoutExercise[];
  tabataModeEnabled: boolean;
  setPlannedWorkout: (workout: PlannedWorkout | null) => void;
  setExercises: (exercises: EditableWorkoutExercise[]) => void;
  setTabataModeEnabled: (enabled: boolean) => void;
  replaceExerciseAt: (index: number, replacement: ReplaceExerciseInput) => void;
  resetDraft: () => void;
};

const WorkoutPlanDraftContext = createContext<WorkoutPlanDraftContextValue | null>(null);

export function WorkoutPlanDraftProvider({ children }: { children: ReactNode }) {
  const [plannedWorkout, setPlannedWorkoutState] = useState<PlannedWorkout | null>(null);
  const [exercises, setExercisesState] = useState<EditableWorkoutExercise[]>([]);
  const [tabataModeEnabled, setTabataModeEnabledState] = useState(false);

  const applyTabataToExercises = useCallback((items: EditableWorkoutExercise[], tabata: boolean) => {
    return tabata ? remapExercisesForExecutionMode(items, 'tabata') : items;
  }, []);

  const setPlannedWorkout = useCallback(
    (workout: PlannedWorkout | null) => {
      setPlannedWorkoutState(workout);
      const base = exercisesFromPlannedWorkout(workout);
      setExercisesState(applyTabataToExercises(base, tabataModeEnabled));
    },
    [applyTabataToExercises, tabataModeEnabled],
  );

  const setExercises = useCallback((next: EditableWorkoutExercise[]) => {
    setExercisesState(next);
  }, []);

  const setTabataModeEnabled = useCallback(
    (enabled: boolean) => {
      setTabataModeEnabledState(enabled);
      setExercisesState((current) => {
        if (current.length === 0) return current;
        if (enabled) return remapExercisesForExecutionMode(current, 'tabata');
        if (plannedWorkout) return exercisesFromPlannedWorkout(plannedWorkout);
        return remapExercisesForExecutionMode(current, 'traditional');
      });
    },
    [plannedWorkout],
  );

  const resetDraft = useCallback(() => {
    setPlannedWorkoutState(null);
    setExercisesState([]);
    setTabataModeEnabledState(false);
  }, []);

  const replaceExerciseAt = useCallback((index: number, replacement: ReplaceExerciseInput) => {
    setExercisesState((current) => {
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
      tabataModeEnabled,
      setPlannedWorkout,
      setExercises,
      setTabataModeEnabled,
      replaceExerciseAt,
      resetDraft,
    }),
    [plannedWorkout, exercises, tabataModeEnabled, setPlannedWorkout, setTabataModeEnabled, replaceExerciseAt, resetDraft],
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
