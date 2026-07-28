import { catalogExerciseBySlug } from '@/constants/exerciseDatabase';
import type { ExerciseClassificationInput, ExerciseType } from '@/types/exerciseClassification';

const TIMED_NAME_PATTERN =
  /\b(plank|wall\s*sit|dead\s*hang|hollow\s*hold|l[\s-]?sit|side\s*plank|superman\s*hold|iso\s*hold|static\s*hold|stretch|carry)\b/i;

const BODYWEIGHT_NAME_PATTERN =
  /\b(pull[\s-]?up|chin[\s-]?up|push[\s-]?up|dip|burpee|air\s*squat|bodyweight|inverted\s*row|muscle[\s-]?up|pistol\s*squat|walking\s*lunge)\b/i;

const CORE_BODYWEIGHT_NAME_PATTERN =
  /\b(windshield\s*wiper|windshield\s*wipers|hanging\s+leg\s+raise|leg\s+raise|v[\s-]?up|toes?\s+to\s+bar|mountain\s+climber|russian\s+twist|dead\s+bug|hollow\s+rock|flutter\s+kick|scissor\s+kick)\b/i;

const CORE_STRENGTH_NAME_PATTERN =
  /\b(weighted\s+sit[\s-]?up|sit[\s-]?up|crunch|cable\s+crunch|ab\s+rollout|rollout|wood\s+chop|pallof\s+press)\b/i;

// Prefer rowing/erg terms — bare "row" matches strength moves (Hammer Row, Cable Row).
const CARDIO_NAME_PATTERN =
  /\b(run|running|jog|sprint|swim|swimming|cycle|cycling|bike|biking|rowing|rower|row\s*erg|erg\s*row|concept\s*2|walk(?:ing)?|treadmill|elliptical|hiit|cardio|jump\s*rope)\b/i;

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
 * Specific stored types win immediately; generic `strength` still falls through to heuristics so
 * bad catalog rows can be recovered at runtime.
 */
export function classifyExercise(input: ExerciseClassificationInput): ExerciseType {
  if (input.exerciseType && input.exerciseType !== 'strength') return input.exerciseType;

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

  if (CORE_BODYWEIGHT_NAME_PATTERN.test(name)) {
    return 'bodyweight';
  }

  if (CORE_STRENGTH_NAME_PATTERN.test(name)) {
    return 'strength';
  }

  if (BODYWEIGHT_NAME_PATTERN.test(name)) {
    return 'bodyweight';
  }

  if (isBodyweightEquipment(equipment) && !LOADED_EQUIPMENT.has(equipment)) {
    return 'bodyweight';
  }

  return input.exerciseType ?? 'strength';
}

export function resolveExerciseType(input: ExerciseClassificationInput): ExerciseType {
  return classifyExercise(input);
}
