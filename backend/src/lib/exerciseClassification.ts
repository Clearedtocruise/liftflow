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
  /\b(plank|wall\s*sit|dead\s*hang|hollow\s*hold|l[\s-]?sit|side\s*plank|superman\s*hold|iso\s*hold|static\s*hold|stretch|carry)\b/i;

const BODYWEIGHT_NAME_PATTERN =
  /\b(pull[\s-]?up|chin[\s-]?up|push[\s-]?up|dip|burpee|air\s*squat|bodyweight|inverted\s*row|muscle[\s-]?up|pistol\s*squat|walking\s*lunge)\b/i;

const CORE_BODYWEIGHT_NAME_PATTERN =
  /\b(windshield\s*wiper|windshield\s*wipers|hanging\s+leg\s+raise|leg\s+raise|v[\s-]?up|toes?\s+to\s+bar|mountain\s+climber|russian\s+twist|dead\s+bug|hollow\s+rock|flutter\s+kick|scissor\s+kick)\b/i;

const CORE_STRENGTH_NAME_PATTERN =
  /\b(weighted\s+sit[\s-]?up|sit[\s-]?up|crunch|cable\s+crunch|ab\s+rollout|rollout|wood\s+chop|pallof\s+press)\b/i;

// Prefer rowing/erg terms — bare "row" matches strength moves (Hammer Low Row, Cable Row).
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

  if (movementCategory === 'cardio' || (CARDIO_NAME_PATTERN.test(name) && !loadedStrength)) {
    return 'cardio';
  }
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
