/**
 * Pattern families — only one exercise per group per workout unless intentionally programmed.
 * Slugs must match exercises.metadata or catalog slugs.
 */
export const MOVEMENT_PATTERN_EXCLUSION_GROUPS: string[][] = [
  ['squat', 'front-squat', 'goblet-squat', 'bodyweight-squat', 'leg-press', 'hack-squat'],
  ['deadlift', 'romanian-deadlift', 'dumbbell-rdl', 'single-leg-rdl'],
  ['walking-lunge', 'dumbbell-lunge', 'reverse-lunge', 'bulgarian-split-squat'],
  ['pull-up', 'chin-up', 'lat-pulldown'],
  ['bench-press', 'incline-bench-press', 'dumbbell-bench-press', 'push-up', 'band-chest-press', 'cable-fly'],
  ['plank', 'side-plank'],
  ['calf-raise', 'standing-calf-raise', 'single-leg-calf-raise'],
];

const slugToPatternGroup = new Map<string, string>();

for (const group of MOVEMENT_PATTERN_EXCLUSION_GROUPS) {
  const groupId = group[0]!;
  for (const slug of group) {
    slugToPatternGroup.set(slug, groupId);
  }
}

export function patternExclusionGroupId(slug: string): string | null {
  return slugToPatternGroup.get(slug) ?? null;
}

export function sharesPatternFamily(slugA: string, slugB: string): boolean {
  const groupA = patternExclusionGroupId(slugA);
  const groupB = patternExclusionGroupId(slugB);
  return groupA != null && groupA === groupB;
}
