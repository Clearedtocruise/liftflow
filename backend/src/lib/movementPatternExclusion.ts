/**
 * Pattern families — limit duplicate movement patterns per workout.
 * Leg days allow more squat/lunge variety than upper days.
 */
export const MOVEMENT_PATTERN_EXCLUSION_GROUPS: string[][] = [
  ['squat', 'front-squat', 'goblet-squat', 'bodyweight-squat', 'leg-press', 'hack-squat', 'landmine-squat'],
  ['deadlift', 'romanian-deadlift', 'dumbbell-rdl', 'single-leg-rdl', 'sumo-deadlift', 'landmine-rdl'],
  ['walking-lunge', 'dumbbell-lunge', 'reverse-lunge', 'bulgarian-split-squat', 'step-up', 'lateral-lunge', 'pistol-squat'],
  ['hip-thrust', 'glute-bridge'],
  ['pull-up', 'chin-up', 'lat-pulldown'],
  ['barbell-row', 'dumbbell-row', 'band-row', 'seated-cable-row'],
  ['overhead-press', 'dumbbell-shoulder-press', 'seated-dumbbell-shoulder-press'],
  ['bench-press', 'incline-bench-press', 'dumbbell-bench-press', 'push-up', 'band-chest-press', 'cable-fly'],
  [
    'close-grip-bench-press',
    'trap-bar-close-grip-press',
    'trap-bar-floor-press',
    'trap-bar-incline-press',
    'smith-close-grip-press',
  ],
  ['pallof-press'],
  ['plank'],
  ['side-plank'],
  ['hanging-leg-raise'],
  ['crunch', 'cable-crunch', 'reverse-crunch', 'bicycle-crunch'],
  ['sit-up'],
  ['dead-bug', 'hollow-hold'],
  ['russian-twist'],
  ['calf-raise', 'standing-calf-raise', 'single-leg-calf-raise'],
  ['dumbbell-curl', 'hammer-curl', 'incline-dumbbell-curl'],
  ['tricep-pushdown', 'dip', 'skull-crusher'],
];

const slugToPatternGroup = new Map<string, string>();

for (const group of MOVEMENT_PATTERN_EXCLUSION_GROUPS) {
  const groupId = group[0]!;
  for (const slug of group) {
    slugToPatternGroup.set(slug, groupId);
  }
}

/** Max picks from the same pattern group per workout (by day focus). */
export function maxPatternUsesForDayFocus(dayFocusKey: string | undefined, patternGroupId: string): number {
  if (dayFocusKey === 'legs_core') {
    if (patternGroupId === 'squat' || patternGroupId === 'walking-lunge') return 3;
    if (patternGroupId === 'hip-thrust' || patternGroupId === 'deadlift') return 2;
    if (patternGroupId === 'plank' || patternGroupId === 'side-plank' || patternGroupId === 'hanging-leg-raise') {
      return 2;
    }
    return 1;
  }
  if (dayFocusKey === 'back_biceps_core') {
    if (patternGroupId === 'barbell-row' || patternGroupId === 'pull-up') return 2;
    if (
      patternGroupId === 'plank' ||
      patternGroupId === 'side-plank' ||
      patternGroupId === 'hanging-leg-raise' ||
      patternGroupId === 'crunch' ||
      patternGroupId === 'sit-up' ||
      patternGroupId === 'dead-bug' ||
      patternGroupId === 'russian-twist'
    ) {
      return 2;
    }
    if (patternGroupId === 'dumbbell-curl' || patternGroupId === 'hammer-curl') return 2;
  }
  if (dayFocusKey === 'chest_shoulders_triceps') {
    if (patternGroupId === 'bench-press' || patternGroupId === 'overhead-press') return 1;
  }
  return 1;
}

export function patternExclusionGroupId(slug: string): string | null {
  const direct = slugToPatternGroup.get(slug);
  if (direct) return direct;
  if (slug === 'pallof-press' || slug.startsWith('pallof-press-')) return 'pallof-press';
  if (slug.includes('half-kneeling-pallof') || slug.includes('anti-rotation')) return 'pallof-press';
  return null;
}

export function sharesPatternFamily(slugA: string, slugB: string): boolean {
  const groupA = patternExclusionGroupId(slugA);
  const groupB = patternExclusionGroupId(slugB);
  return groupA != null && groupA === groupB;
}
