/**
 * Groups an exercise into the movement family that determines how it is coached.
 *
 * The catalog's stored `movement_family` is not trustworthy: the bulk import tagged 200 exercises
 * as `horizontal_press`, including triceps kickbacks and lateral raises, which is what produced
 * bench-press loads on a kickback. The exercise name is the most reliable signal available at
 * runtime, so it is matched first, then muscle groups, then the broad movement category.
 *
 * Families exist to make written guidance specific. Anything that cannot be identified confidently
 * stays `null` so the caller falls back to honest category guidance rather than guessing.
 */

import type { MovementCategory } from '@/types/common';

export type MovementFamily =
  | 'horizontal_press'
  | 'vertical_press'
  | 'chest_isolation'
  | 'triceps_isolation'
  | 'vertical_pull'
  | 'horizontal_pull'
  | 'biceps_isolation'
  | 'rear_delt'
  | 'lateral_raise'
  | 'squat_pattern'
  | 'lunge_pattern'
  | 'hinge_pattern'
  | 'glute_isolation'
  | 'quad_isolation'
  | 'hamstring_isolation'
  | 'calf_isolation'
  | 'core_anti_extension'
  | 'core_anti_lateral'
  | 'core_flexion'
  | 'core_rotation'
  | 'carry'
  | 'cardio';

export type MovementFamilyInput = {
  name?: string | null;
  slug?: string | null;
  category?: MovementCategory | null;
  equipment?: string | null;
  muscleGroups?: string[] | null;
};

/**
 * Ordered because exercise names overlap: "Cable Triceps Kickback" contains "cable" and
 * "kickback", and "Romanian Deadlift" contains "deadlift". The first match wins, so the more
 * specific pattern is listed before the broader one it would otherwise be swallowed by.
 */
const NAME_RULES: Array<{ family: MovementFamily; pattern: RegExp }> = [
  // Glute kickbacks must be separated from triceps kickbacks before either generic rule.
  { family: 'glute_isolation', pattern: /\b(glute|donkey)\s*(kick\s*back|kickback|kick)\b|\bfire\s*hydrant\b|\bhip\s*(thrust|abduction)\b|\bglute\s*bridge\b/i },
  { family: 'triceps_isolation', pattern: /\bkick\s*backs?\b|\btricep|\bskull\s*crush|\bpushdown|\boverhead\s+extension|\bjm\s+press\b|\bclose\s*grip\s+(bench|push)/i },
  { family: 'lateral_raise', pattern: /\blateral\s+raise|\bside\s+raise|\bfront\s+raise|\bdelt\s+raise/i },
  { family: 'rear_delt', pattern: /\brear\s+delt|\bface\s*pull|\breverse\s+(fly|flye)|\bpull\s*apart/i },
  // "Nordic Curl" is a hamstring eccentric and "Wrist Curl" is forearm work; neither may be
  // coached as a biceps curl, so both are handled before the generic curl rule.
  { family: 'hamstring_isolation', pattern: /\bnordic\b|\bleg\s+curls?\b|\bhamstring\s+curls?\b/i },
  { family: 'biceps_isolation', pattern: /(?<!wrist\s)\bcurl\b/i },
  { family: 'chest_isolation', pattern: /\b(fly|flye|pec\s*deck|cross\s*over|crossover)\b/i },

  { family: 'core_anti_lateral', pattern: /\bside\s*planks?\b|\bsuitcase\s+(hold|carry)\b|\bpallof\b|\bside\s+bends?\b/i },
  { family: 'core_anti_extension', pattern: /\bplanks?\b|\bdead\s*bugs?\b|\bhollow\s*(hold|rock)|\bab\s*roll|\brollouts?\b/i },
  { family: 'core_rotation', pattern: /\brussian\s+twist|\bwood\s*chop|\btwists?\b|\brotation/i },
  { family: 'core_flexion', pattern: /\bcrunch|\bsit[\s-]?ups?\b|\bleg\s+raises?\b|\bv[\s-]?ups?\b|\btoes?\s+to\s+bar\b|\bknee\s+raises?\b/i },

  { family: 'calf_isolation', pattern: /\bcalf\b|\bcalves\b/i },
  { family: 'quad_isolation', pattern: /\bleg\s+extensions?\b/i },

  { family: 'lunge_pattern', pattern: /\blunges?\b|\bsplit\s+squat\b|\bstep[\s-]?ups?\b/i },
  { family: 'hinge_pattern', pattern: /\bdeadlift|\brdl\b|\bromanian\b|\bgood\s*morning\b|\bhip\s+hinge\b|\bswing\b|\bpull[\s-]?through\b/i },
  { family: 'squat_pattern', pattern: /\bsquat\b|\bleg\s+press\b|\bhack\b/i },

  { family: 'vertical_pull', pattern: /\bpull[\s-]?ups?\b|\bchin[\s-]?ups?\b|\bpull\s*downs?\b|\bpulldowns?\b|\blat\s+pull/i },
  { family: 'horizontal_pull', pattern: /\brows?\b|\bseated\s+cable\s+row\b/i },
  { family: 'vertical_press', pattern: /\boverhead\s+press\b|\bshoulder\s+press\b|\bmilitary\s+press\b|\bpush\s*press\b|\barnold\s+press\b|\bohp\b/i },
  { family: 'horizontal_press', pattern: /\bbench\s+press\b|\bchest\s+press\b|\bpush[\s-]?ups?\b|\bdips?\b|\bfloor\s+press\b/i },

  { family: 'carry', pattern: /\bcarry\b|\bcarries\b|\bfarmer|\byoke\b|\bsled\s+(push|drag|pull)\b|\bprowler\b/i },
  { family: 'cardio', pattern: /\brun(ning)?\b|\bjog|\bsprint|\bcycl|\bbike|\brow(ing)?\s*(machine|erg)\b|\btreadmill|\belliptical|\bswim|\bjump\s*rope|\bwalk(ing)?\b/i },
];

const MUSCLE_RULES: Array<{ family: MovementFamily; muscles: string[] }> = [
  { family: 'calf_isolation', muscles: ['calves'] },
  { family: 'biceps_isolation', muscles: ['biceps'] },
  { family: 'triceps_isolation', muscles: ['triceps'] },
  { family: 'glute_isolation', muscles: ['glutes'] },
  { family: 'hamstring_isolation', muscles: ['hamstrings'] },
  { family: 'quad_isolation', muscles: ['quads'] },
  { family: 'core_anti_extension', muscles: ['core', 'abs'] },
  { family: 'core_rotation', muscles: ['obliques'] },
];

function normalize(value: string | null | undefined): string {
  return (value ?? '').replace(/[-_]+/g, ' ').trim();
}

export function resolveMovementFamily(input: MovementFamilyInput): MovementFamily | null {
  const haystack = `${normalize(input.name)} ${normalize(input.slug)}`.trim();

  if (haystack) {
    for (const rule of NAME_RULES) {
      if (rule.pattern.test(haystack)) return rule.family;
    }
  }

  // Muscle groups only decide an isolation family when a single primary muscle is named; a
  // compound lift lists several and must not be coached as an isolation movement.
  const muscles = (input.muscleGroups ?? []).map((muscle) => muscle.toLowerCase());
  if (muscles.length === 1) {
    for (const rule of MUSCLE_RULES) {
      if (rule.muscles.includes(muscles[0]!)) return rule.family;
    }
  }

  /**
   * There is deliberately no category fallback. The imported categories carry the same noise as
   * `movement_family`: Burpee and Barbell Complex are stored as `carry`, Neck Flexion as `squat`,
   * and Sled Push as `hinge`. Returning null lets the caller use honest general guidance rather
   * than coaching a burpee like a loaded carry.
   */
  return null;
}
