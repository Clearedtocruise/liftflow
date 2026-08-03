import AsyncStorage from '@react-native-async-storage/async-storage';

import type { EditableWorkoutExercise } from '@/types/workoutExecution';

/**
 * Unsaved edits to a planned workout, held on disk so backgrounding the app mid-edit is not
 * destructive. Only one draft is kept: editing a second workout without saving the first is a
 * deliberate abandonment of the first.
 */
export type StoredWorkoutPlanDraft = {
  plannedWorkoutId: string;
  exercises: EditableWorkoutExercise[];
  savedAt: string;
};

const KEY = '@liftflow/workout-plan-draft';

/**
 * A draft older than this is dropped rather than restored. Resurrecting week-old edits onto a plan
 * that has since been regenerated would be worse than losing them.
 */
const MAX_AGE_MS = 48 * 60 * 60 * 1000;

export const workoutPlanDraftStore = {
  async read(): Promise<StoredWorkoutPlanDraft | null> {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (!raw) return null;

      const draft = JSON.parse(raw) as StoredWorkoutPlanDraft;
      if (!draft?.plannedWorkoutId || !Array.isArray(draft.exercises)) return null;

      const age = Date.now() - new Date(draft.savedAt).getTime();
      if (!Number.isFinite(age) || age > MAX_AGE_MS) {
        await AsyncStorage.removeItem(KEY);
        return null;
      }
      return draft;
    } catch {
      return null;
    }
  },

  async write(plannedWorkoutId: string, exercises: EditableWorkoutExercise[]): Promise<void> {
    try {
      const draft: StoredWorkoutPlanDraft = {
        plannedWorkoutId,
        exercises,
        savedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(KEY, JSON.stringify(draft));
    } catch {
      // A failed write costs the offline safety net, not the edit itself.
    }
  },

  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(KEY);
    } catch {
      // Nothing to recover from: a stale draft is discarded on read by its age check.
    }
  },
};
