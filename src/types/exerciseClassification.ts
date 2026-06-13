/**
 * Exercise classification taxonomy (Sprint 1).
 * Mirror PostgreSQL enum `public.exercise_type` in supabase/schema.sql.
 */
export type ExerciseType = 'strength' | 'bodyweight' | 'timed' | 'cardio';

export const EXERCISE_TYPES: ExerciseType[] = ['strength', 'bodyweight', 'timed', 'cardio'];

export type ExerciseClassificationInput = {
  slug?: string | null;
  name: string;
  equipment?: string | null;
  movementCategory?: string | null;
  exerciseType?: ExerciseType | null;
};
