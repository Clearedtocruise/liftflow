import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';

import { editableExercisesToTemplate, exercisesFromPlannedWorkout } from '@/lib/workoutPlan';
import { workoutPlanDraftStore, type StoredWorkoutPlanDraft } from '@/lib/workoutPlanDraftStore';
import type { PlannedWorkout } from '@/types/training';
import type { EditableWorkoutExercise } from '@/types/workoutExecution';

type ReplaceExerciseInput = {
  name: string;
  exerciseId?: string;
};

type WorkoutPlanDraftContextValue = {
  plannedWorkout: PlannedWorkout | null;
  exercises: EditableWorkoutExercise[];
  /** True when `exercises` no longer matches what the planned workout holds in the database. */
  isDirty: boolean;
  setPlannedWorkout: (workout: PlannedWorkout | null) => void;
  setExercises: (exercises: EditableWorkoutExercise[]) => void;
  /**
   * Replaces the draft with the plan a session is running. That plan is derived from the planned
   * workout — remapped for Tabata, say — rather than edited by the user, so it becomes the new
   * baseline instead of looking like an unsaved edit worth restoring later.
   */
  setSessionPlan: (exercises: EditableWorkoutExercise[]) => void;
  replaceExerciseAt: (index: number, replacement: ReplaceExerciseInput) => void;
  /** Call after a successful write so the saved exercises become the new baseline. */
  markSaved: (workout: PlannedWorkout) => void;
  /** Throws the edits away and returns to what the database holds. */
  discardEdits: () => void;
  resetDraft: () => void;
};

const WorkoutPlanDraftContext = createContext<WorkoutPlanDraftContextValue | null>(null);

/** Canonical form for comparison: ignores the cosmetic row ids the edit screen generates. */
function baselineOf(exercises: EditableWorkoutExercise[]): string {
  return JSON.stringify(editableExercisesToTemplate(exercises));
}

export function WorkoutPlanDraftProvider({ children }: { children: ReactNode }) {
  const [plannedWorkout, setPlannedWorkoutState] = useState<PlannedWorkout | null>(null);
  const [exercises, setExercisesState] = useState<EditableWorkoutExercise[]>([]);
  /** What the database held when this workout was loaded or last saved. */
  const [baseline, setBaseline] = useState('[]');

  const isDirty = useMemo(() => baselineOf(exercises) !== baseline, [exercises, baseline]);

  const plannedWorkoutRef = useRef<PlannedWorkout | null>(null);
  plannedWorkoutRef.current = plannedWorkout;
  const isDirtyRef = useRef(false);
  isDirtyRef.current = isDirty;

  /** An unsaved draft read back from disk, held until the workout it belongs to is loaded. */
  const restorableRef = useRef<StoredWorkoutPlanDraft | null>(null);
  /** Which workout the draft currently on disk belongs to. */
  const persistedIdRef = useRef<string | null>(null);

  /**
   * Applies a stored draft to a workout, if it belongs to that workout and actually differs from
   * what the database holds. Returns the exercises to use.
   */
  const takeRestorable = useCallback(
    (workout: PlannedWorkout, fromDatabase: EditableWorkoutExercise[]) => {
      const stored = restorableRef.current;
      if (!stored || stored.plannedWorkoutId !== workout.id) return null;
      restorableRef.current = null;
      if (baselineOf(stored.exercises) === baselineOf(fromDatabase)) return null;
      persistedIdRef.current = workout.id;
      return stored.exercises;
    },
    [],
  );

  useEffect(() => {
    void workoutPlanDraftStore.read().then((stored) => {
      if (!stored) return;
      restorableRef.current = stored;
      persistedIdRef.current = stored.plannedWorkoutId;

      // The plan can finish loading before this read resolves, in which case the workout the draft
      // belongs to is already on screen and nothing else will come along to apply it.
      const current = plannedWorkoutRef.current;
      if (!current || isDirtyRef.current) return;
      const restored = takeRestorable(current, exercisesFromPlannedWorkout(current));
      if (restored) setExercisesState(restored);
    });
  }, [takeRestorable]);

  useEffect(() => {
    const id = plannedWorkout?.id;
    if (!id) return;

    if (isDirty) {
      persistedIdRef.current = id;
      void workoutPlanDraftStore.write(id, exercises);
      return;
    }

    // Only drop the stored draft when it belongs to this workout. Opening another day must not
    // discard edits that are still waiting on the day they were made for.
    if (persistedIdRef.current === id) {
      persistedIdRef.current = null;
      restorableRef.current = null;
      void workoutPlanDraftStore.clear();
    }
  }, [plannedWorkout?.id, exercises, isDirty]);

  const setExercises = useCallback((next: EditableWorkoutExercise[]) => {
    setExercisesState(next);
  }, []);

  const setSessionPlan = useCallback((next: EditableWorkoutExercise[]) => {
    setExercisesState(next);
    setBaseline(baselineOf(next));
  }, []);

  const setPlannedWorkout = useCallback(
    (workout: PlannedWorkout | null) => {
      setPlannedWorkoutState(workout);

      if (!workout) {
        setExercisesState([]);
        setBaseline('[]');
        return;
      }

      const fromDatabase = exercisesFromPlannedWorkout(workout);
      setBaseline(baselineOf(fromDatabase));

      // The workout tab reloads the week on focus, on app resume and on day rollover, and every
      // reload lands here. Overwriting the exercises each time is what discarded unsaved edits.
      if (workout.id === plannedWorkoutRef.current?.id && isDirtyRef.current) return;

      setExercisesState(takeRestorable(workout, fromDatabase) ?? fromDatabase);
    },
    [takeRestorable],
  );

  const markSaved = useCallback((workout: PlannedWorkout) => {
    const saved = exercisesFromPlannedWorkout(workout);
    setPlannedWorkoutState(workout);
    setExercisesState(saved);
    setBaseline(baselineOf(saved));
  }, []);

  const discardEdits = useCallback(() => {
    const fromDatabase = exercisesFromPlannedWorkout(plannedWorkoutRef.current);
    setExercisesState(fromDatabase);
    setBaseline(baselineOf(fromDatabase));
  }, []);

  const resetDraft = useCallback(() => {
    setPlannedWorkoutState(null);
    setExercisesState([]);
    setBaseline('[]');
    restorableRef.current = null;
    persistedIdRef.current = null;
    void workoutPlanDraftStore.clear();
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
      isDirty,
      setPlannedWorkout,
      setExercises,
      setSessionPlan,
      replaceExerciseAt,
      markSaved,
      discardEdits,
      resetDraft,
    }),
    [
      plannedWorkout,
      exercises,
      isDirty,
      setPlannedWorkout,
      setExercises,
      setSessionPlan,
      replaceExerciseAt,
      markSaved,
      discardEdits,
      resetDraft,
    ],
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
