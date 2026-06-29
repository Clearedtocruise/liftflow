import { useMemo } from 'react';

import type { WeightUnit } from '@/constants/units';
import { parseWeightToKg } from '@/lib/unitConversion';
import type { WorkoutSession } from '@/types';

import type { VoiceWorkoutHandlers } from './workoutCommandTypes';

type ActiveWorkoutVoiceHandlerParams = {
  session: WorkoutSession;
  sortedExerciseIds: string[];
  currentExerciseId: string | undefined;
  currentExerciseName: string | undefined;
  completedSetCount: number;
  targetSetCount: number;
  restTargetSeconds: number;
  preferredWeightUnit: WeightUnit;
  isPaused: boolean;
  logSetFromVoice: (input: {
    workoutExerciseId: string;
    weightKg?: number;
    reps: number;
    restSeconds: number;
  }) => Promise<boolean>;
  undoLastSet: () => Promise<boolean>;
  goToExerciseIndex: (index: number) => void;
  startRestSeconds: (seconds: number) => Promise<void>;
  finishWorkout: () => void;
  replaceExerciseInSession: (newExerciseName: string) => Promise<boolean>;
};

function findExerciseIndexByName(
  session: WorkoutSession,
  sortedIds: string[],
  name?: string,
  fallbackId?: string,
): number {
  if (!name?.trim()) {
    const fallbackIndex = sortedIds.findIndex((id) => id === fallbackId);
    return fallbackIndex >= 0 ? fallbackIndex : 0;
  }

  const needle = name.toLowerCase();
  const sorted = [...session.exercises].sort((a, b) => a.sortOrder - b.sortOrder);

  const exact = sorted.findIndex((ex) => ex.exercise?.name?.toLowerCase() === needle);
  if (exact >= 0) return exact;

  const partial = sorted.findIndex((ex) => ex.exercise?.name?.toLowerCase().includes(needle));
  if (partial >= 0) return partial;

  const fallbackIndex = sorted.findIndex((ex) => ex.id === fallbackId);
  return fallbackIndex >= 0 ? fallbackIndex : 0;
}

export function useActiveWorkoutVoiceHandlers(
  params: ActiveWorkoutVoiceHandlerParams,
): VoiceWorkoutHandlers {
  const {
    session,
    sortedExerciseIds,
    currentExerciseId,
    currentExerciseName,
    completedSetCount,
    targetSetCount,
    restTargetSeconds,
    preferredWeightUnit,
    isPaused,
    logSetFromVoice,
    undoLastSet,
    goToExerciseIndex,
    startRestSeconds,
    finishWorkout,
    replaceExerciseInSession,
  } = params;

  return useMemo(
    (): VoiceWorkoutHandlers => ({
      logSet: async ({ exerciseName, weight, weightUnit, reps, bodyweight }) => {
        if (isPaused) {
          return { ok: false, message: 'Workout is paused.' };
        }

        const index = findExerciseIndexByName(
          session,
          sortedExerciseIds,
          exerciseName,
          currentExerciseId,
        );
        const exercise = [...session.exercises].sort((a, b) => a.sortOrder - b.sortOrder)[index];
        if (!exercise) {
          return { ok: false, message: 'Could not find that exercise in this workout.' };
        }

        let weightKg: number | undefined;
        if (!bodyweight && weight != null) {
          const unit = weightUnit ?? preferredWeightUnit;
          weightKg = parseWeightToKg(String(weight), unit === 'kg' ? 'kg' : 'lb');
        }

        const logged = await logSetFromVoice({
          workoutExerciseId: exercise.id,
          weightKg,
          reps,
          restSeconds: restTargetSeconds,
        });

        if (!logged) {
          return { ok: false, message: 'Could not log that set. Try manual entry.' };
        }

        const label = exercise.exercise?.name ?? exerciseName ?? currentExerciseName ?? 'Set';
        return {
          ok: true,
          message: `Logged ${label}.`,
          shouldStartRestTimer: true,
        };
      },

      nextExercise: async () => {
        const sorted = [...session.exercises].sort((a, b) => a.sortOrder - b.sortOrder);
        const currentIndex = sorted.findIndex((ex) => ex.id === currentExerciseId);
        const nextIndex = Math.min(currentIndex + 1, sorted.length - 1);
        if (nextIndex === currentIndex) {
          return { ok: false, message: 'Already on the last exercise.' };
        }
        goToExerciseIndex(nextIndex);
        return { ok: true, message: 'Moved to next exercise.' };
      },

      previousExercise: async () => {
        const sorted = [...session.exercises].sort((a, b) => a.sortOrder - b.sortOrder);
        const currentIndex = sorted.findIndex((ex) => ex.id === currentExerciseId);
        const prevIndex = Math.max(currentIndex - 1, 0);
        if (prevIndex === currentIndex) {
          return { ok: false, message: 'Already on the first exercise.' };
        }
        goToExerciseIndex(prevIndex);
        return { ok: true, message: 'Moved to previous exercise.' };
      },

      startRestTimer: async (durationSeconds) => {
        await startRestSeconds(durationSeconds);
        return { ok: true, message: `Rest timer started for ${durationSeconds} seconds.` };
      },

      finishWorkout: async () => {
        finishWorkout();
        return { ok: true, message: 'Workout finished.' };
      },

      askStatus: async () => {
        const remaining = Math.max(targetSetCount - completedSetCount, 0);
        const exerciseLabel = currentExerciseName ?? 'this exercise';
        return {
          ok: true,
          message: `${remaining} sets remaining on ${exerciseLabel}.`,
        };
      },

      undoLastSet: async () => {
        if (isPaused) {
          return { ok: false, message: 'Workout is paused.' };
        }
        const removed = await undoLastSet();
        if (!removed) {
          return { ok: false, message: 'No set to undo.' };
        }
        return { ok: true, message: 'Removed last set.' };
      },

      replaceExercise: async (_fromName, toName) => {
        if (isPaused) {
          return { ok: false, message: 'Workout is paused.' };
        }

        const targetName = toName?.trim();
        if (!targetName) {
          return { ok: false, message: 'Say which exercise to switch to.' };
        }

        const replaced = await replaceExerciseInSession(targetName);
        if (!replaced) {
          return { ok: false, message: `Could not replace with ${targetName}.` };
        }

        return {
          ok: true,
          message: `Swapped to ${targetName}. Logged sets are still saved.`,
        };
      },
    }),
    [
      session,
      sortedExerciseIds,
      currentExerciseId,
      currentExerciseName,
      completedSetCount,
      targetSetCount,
      restTargetSeconds,
      preferredWeightUnit,
      isPaused,
      logSetFromVoice,
      undoLastSet,
      goToExerciseIndex,
      startRestSeconds,
      finishWorkout,
      replaceExerciseInSession,
    ],
  );
}
