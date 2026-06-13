import { catalogExerciseBySlug } from '@/constants/exerciseDatabase';
import type { ExerciseClassificationInput, ExerciseType } from '@/types/exerciseClassification';

const TIMED_NAME_PATTERN =
  /\b(plank|wall\s*sit|dead\s*hang|hollow\s*hold|l[\s-]?sit|side\s*plank|superman\s*hold|iso\s*hold|static\s*hold|stretch|carry)\b/i;

const BODYWEIGHT_NAME_PATTERN =
  /\b(pull[\s-]?up|chin[\s-]?up|push[\s-]?up|dip|burpee|air\s*squat|bodyweight|inverted\s*row|muscle[\s-]?up|pistol\s*squat|walking\s*lunge)\b/i;

const CARDIO_NAME_PATTERN =
  /\b(run|running|jog|sprint|swim|swimming|cycle|cycling|bike|biking|row(?:ing)?|walk(?:ing)?|treadmill|elliptical|hiit|cardio|jump\s*rope)\b/i;

const LOADED_EQUIPMENT = new Set([
  'barbell',
  'dumbbell',
  'cable',
  'machine',
  'bands',
  'kettlebell',
  'smith',
  'ez_bar',
  'trap_bar',
]);

function normalize(value: string | undefined | null): string {
  return (value ?? '').trim().toLowerCase();
}

function isBodyweightEquipment(equipment: string): boolean {
  return equipment === 'bodyweight' || equipment === 'none' || equipment === 'pull_up_bar';
}

/**
 * Classify an exercise into exactly one Sprint 1 category.
 * Priority: stored type → catalog slug → cardio → timed → bodyweight → strength.
 */
export function classifyExercise(input: ExerciseClassificationInput): ExerciseType {
  if (input.exerciseType) return input.exerciseType;

  const slug = normalize(input.slug);
  if (slug) {
    const catalogMatch = catalogExerciseBySlug(slug);
    if (catalogMatch) return catalogMatch.exerciseType;
  }

  const name = normalize(input.name);
  const equipment = normalize(input.equipment);
  const movementCategory = normalize(input.movementCategory);

  if (movementCategory === 'cardio' || CARDIO_NAME_PATTERN.test(name)) {
    return 'cardio';
  }

  if (TIMED_NAME_PATTERN.test(name)) {
    return 'timed';
  }

  if (BODYWEIGHT_NAME_PATTERN.test(name)) {
    return 'bodyweight';
  }

  if (isBodyweightEquipment(equipment) && !LOADED_EQUIPMENT.has(equipment)) {
    return 'bodyweight';
  }

  return 'strength';
}

export function resolveExerciseType(input: ExerciseClassificationInput): ExerciseType {
  return classifyExercise(input);
}
