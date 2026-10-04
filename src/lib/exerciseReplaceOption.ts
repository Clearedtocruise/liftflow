/**
 * Adapts a catalog exercise into the shape the replace flow swaps in.
 *
 * Replacement started life as an AI-only feature, so every caller takes an
 * `ExerciseAlternativeOption`. A lifter searching for a lift by hand produces an `Exercise`
 * instead, and converting here keeps the single replace callback on both paths.
 */

import type { ExerciseAlternativeOption } from '@/services/exerciseAdvisoryService';
import type { Exercise } from '@/types';

type SearchedExercise = Pick<Exercise, 'name'> &
  Partial<Pick<Exercise, 'id' | 'slug' | 'equipment' | 'muscleGroups'>>;

export const MANUAL_REPLACEMENT_REASON = 'You picked this one';

export function exerciseToAlternativeOption(exercise: SearchedExercise): ExerciseAlternativeOption {
  const name = exercise.name.trim();

  return {
    name,
    slug: exercise.slug || exercise.id || slugifyExerciseName(name),
    muscleGroups: exercise.muscleGroups ?? [],
    equipment: exercise.equipment || 'Other',
    reason: MANUAL_REPLACEMENT_REASON,
  };
}

function slugifyExerciseName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
