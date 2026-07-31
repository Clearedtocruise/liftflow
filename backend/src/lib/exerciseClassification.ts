/**
 * Sprint 1 exercise classification — backend mirror for tests and future API use.
 * Keep in sync with src/constants/exerciseDatabase.ts and src/lib/exerciseClassification.ts.
 */

export type ExerciseType = 'strength' | 'bodyweight' | 'timed' | 'cardio';

export type ExerciseClassificationInput = {
  slug?: string | null;
  name: string;
  equipment?: string | null;
  movementCategory?: string | null;
  exerciseType?: ExerciseType | null;
};

const CATALOG: Record<string, ExerciseType> = {
  'bench-press': 'strength',
  'incline-bench-press': 'strength',
  'overhead-press': 'strength',
  squat: 'strength',
  'front-squat': 'strength',
  deadlift: 'strength',
  'romanian-deadlift': 'strength',
  'barbell-row': 'strength',
  'lat-pulldown': 'strength',
  'dumbbell-curl': 'strength',
  'tricep-pushdown': 'strength',
  'leg-press': 'strength',
  'leg-curl': 'strength',
  'calf-raise': 'strength',
  'band-chest-press': 'strength',
  'dumbbell-bench-press': 'strength',
  'dumbbell-shoulder-press': 'strength',
  'dumbbell-row': 'strength',
  'band-row': 'strength',
  'goblet-squat': 'strength',
  'dumbbell-rdl': 'strength',
  'band-pull-apart': 'strength',
  'dumbbell-lunge': 'strength',
  'cable-fly': 'strength',
  'seated-cable-row': 'strength',
  'hack-squat': 'strength',
  'pull-up': 'bodyweight',
  'push-up': 'bodyweight',
  'bodyweight-squat': 'bodyweight',
  'walking-lunge': 'bodyweight',
  plank: 'timed',
  'side-plank': 'timed',
  running: 'cardio',
  swimming: 'cardio',
  cycling: 'cardio',
  rowing: 'cardio',
  'recovery-walk': 'cardio',
};

const TIMED_NAME_PATTERN =
  // Mirrors the client pattern. Plurals matter: `\bplank\b` misses "Side Planks", which then
  // classified as strength and asked for weight and reps on a hold.
  /\b(planks?|wall[\s-]*sits?|dead[\s-]*hangs?|hollow[\s-]*holds?|l[\s-]?sits?|superman[\s-]*holds?|iso[\s-]*holds?|static[\s-]*holds?|stretch(?:es)?|carr(?:y|ies))\b/i;

const BODYWEIGHT_NAME_PATTERN =
  /\b(pull[\s-]?up|chin[\s-]?up|push[\s-]?up|dip|burpee|air\s*squat|bodyweight|inverted\s*row|muscle[\s-]?up|pistol\s*squat|walking\s*lunge)\b/i;

const CORE_BODYWEIGHT_NAME_PATTERN =
  /\b(windshield\s*wiper|windshield\s*wipers|hanging\s+leg\s+raise|leg\s+raise|v[\s-]?up|toes?\s+to\s+bar|mountain\s+climber|russian\s+twist|dead\s+bug|hollow\s+rock|flutter\s+kick|scissor\s+kick)\b/i;

const CORE_STRENGTH_NAME_PATTERN =
  /\b(weighted\s+sit[\s-]?up|sit[\s-]?up|crunch|cable\s+crunch|ab\s+rollout|rollout|wood\s+chop|pallof\s+press)\b/i;

const CARDIO_NAME_PATTERN =
  /\b(run|running|jog|jogging|sprint|swim|swimming|cycle|cycling|bike|biking|walk(?:ing)?|treadmill|elliptical|stair\s*climber|hiit|cardio|jump\s*rope)\b/i;

/**
 * A bare "row" is a pulling lift, so only machine/erg rowing counts as cardio. Matching "row" on
 * its own put every barbell, cable and hammer row on the distance-and-duration logger.
 */
const CARDIO_ROW_NAME_PATTERN =
  /\b(rowing|rower|row\s*(?:machine|erg|ergometer)|erg\s*row|concept\s*2)\b/i;

/**
 * Loaded carries and walking lunges read as cardio but are weight-and-reps work, so they are
 * excluded before the cardio patterns run.
 */
const CARDIO_LOOKALIKE_NAME_PATTERN =
  /\b(walking\s*lunge|lunge\s*walk|farmer'?s?\s*(?:walk|carry)|suitcase\s*(?:walk|carry)|waiter\s*walk|overhead\s*(?:walk|carry)|sled\s*(?:push|pull|drag))\b/i;

function isCardioName(name: string): boolean {
  if (CARDIO_LOOKALIKE_NAME_PATTERN.test(name)) return false;
  return CARDIO_NAME_PATTERN.test(name) || CARDIO_ROW_NAME_PATTERN.test(name);
}

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

export function classifyExercise(input: ExerciseClassificationInput): ExerciseType {
  if (input.exerciseType && input.exerciseType !== 'strength') return input.exerciseType;

  const slug = normalize(input.slug);
  if (slug && CATALOG[slug]) return CATALOG[slug];

  const name = normalize(input.name);
  const equipment = normalize(input.equipment);
  const movementCategory = normalize(input.movementCategory);

  // Never demote loaded strength moves to cardio (skips between-set rest / blocks weight).
  const loadedStrength =
    input.exerciseType === 'strength' && LOADED_EQUIPMENT.has(equipment);

  if (movementCategory === 'cardio' || (isCardioName(name) && !loadedStrength)) return 'cardio';
  if (TIMED_NAME_PATTERN.test(name)) return 'timed';
  if (CORE_BODYWEIGHT_NAME_PATTERN.test(name)) return 'bodyweight';
  if (CORE_STRENGTH_NAME_PATTERN.test(name)) return 'strength';
  if (BODYWEIGHT_NAME_PATTERN.test(name)) return 'bodyweight';
  if (equipment === 'bodyweight' || equipment === 'none' || equipment === 'pull_up_bar') return 'bodyweight';

  return input.exerciseType ?? 'strength';
}

export function catalogCountsByType(): Record<ExerciseType, number> {
  const counts: Record<ExerciseType, number> = {
    strength: 0,
    bodyweight: 0,
    timed: 0,
    cardio: 0,
  };
  for (const type of Object.values(CATALOG)) {
    counts[type] += 1;
  }
  return counts;
}
