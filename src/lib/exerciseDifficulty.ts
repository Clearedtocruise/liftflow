import type { Exercise } from '@/types';

export type ExerciseDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';

/**
 * Skill-limited movements: someone can be strong enough and still not able to perform these, so
 * equipment alone does not describe them.
 */
const ADVANCED_NAME_PATTERN =
  /\b(muscle[\s-]?up|pistol\s*squat|planche|front\s*lever|iron\s*cross|handstand|snatch|clean\s*(?:and|&)\s*jerk|power\s*clean|hang\s*clean|split\s*jerk|turkish\s*get[\s-]?up|overhead\s*squat|jefferson\s*curl)\b/i;

/** Free-weight compounds and bodyweight pulling — loadable, but they need a coached setup. */
const INTERMEDIATE_NAME_PATTERN =
  /\b(back\s*squat|front\s*squat|squat|deadlift|romanian\s*deadlift|rdl|sumo\s*deadlift|bench\s*press|incline\s*bench|overhead\s*press|military\s*press|barbell\s*row|pendlay\s*row|t[\s-]?bar\s*row|bent\s*over\s*row|pull[\s-]?up|chin[\s-]?up|dip|good\s*morning|bulgarian\s*split\s*squat|split\s*squat|walking\s*lunge|lunge|hip\s*thrust|skull\s*crusher|landmine)\b/i;

/** Guided-path equipment: the machine or cable holds the position, so the lifter does not have to. */
const GUIDED_PATH_EQUIPMENT = new Set(['machine', 'cable', 'bands', 'smith']);

const FREE_WEIGHT_EQUIPMENT = new Set(['barbell', 'trap_bar', 'ez_bar']);

function normalize(value: string | undefined | null): string {
  return (value ?? '').trim().toLowerCase();
}

/**
 * Difficulty is not stored on the exercise record, so it is derived from the movement itself: skill
 * demand first, then the compound lifts, then how much the equipment stabilises the lifter.
 */
export function resolveExerciseDifficulty(
  exercise?: Exercise | null,
  nameFallback?: string,
): ExerciseDifficulty {
  const name = normalize(exercise?.name ?? nameFallback);

  if (ADVANCED_NAME_PATTERN.test(name)) return 'Advanced';

  const equipment = normalize(exercise?.equipment);
  const isGuidedPath = GUIDED_PATH_EQUIPMENT.has(equipment);

  // A guided-path version of a compound lift (leg press, cable row, assisted pull-up) removes the
  // balance demand that makes the free-weight lift intermediate. Bodyweight versions do not, which
  // is why pull-ups and dips are not downgraded here.
  if (INTERMEDIATE_NAME_PATTERN.test(name) && !isGuidedPath) return 'Intermediate';

  if (isGuidedPath) return 'Beginner';
  if (FREE_WEIGHT_EQUIPMENT.has(equipment)) return 'Intermediate';

  return 'Beginner';
}
