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
    // One vertical-pull pattern max (prevents 5 pull-up variants in one session).
    if (patternGroupId === 'pull-up') return 1;
    if (patternGroupId === 'barbell-row') return 2;
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

  const n = slug.toLowerCase();

  if (n === 'pallof-press' || n.startsWith('pallof-press-')) return 'pallof-press';
  if (n.includes('half-kneeling-pallof') || n.includes('anti-rotation')) return 'pallof-press';

  // Catalog variants (wide-pull-up, archer-pull-up-ba0422, typewriter-pull-up, etc.)
  if (/\bpull[\s-]?up\b/.test(n) || n.includes('pullup') || /\bchin[\s-]?up\b/.test(n) || n.includes('chinup')) {
    return 'pull-up';
  }
  if (n.includes('lat-pulldown') || n.includes('lat_pulldown') || n.includes('pulldown')) {
    return 'pull-up';
  }
  if (/\bpush[\s-]?up\b/.test(n) || n.includes('pushup')) {
    return 'bench-press';
  }
  if (/\bdip\b/.test(n) && !n.includes('shoulder')) {
    return 'tricep-pushdown';
  }
  if (n.includes('squat') && !n.includes('split')) {
    return 'squat';
  }
  if (n.includes('lunge') || n.includes('split-squat') || n.includes('step-up')) {
    return 'walking-lunge';
  }
  if (n.includes('deadlift') || n.includes('-rdl') || n.endsWith('rdl')) {
    return 'deadlift';
  }
  if (n.includes('hip-thrust') || n.includes('glute-bridge')) {
    return 'hip-thrust';
  }
  if (n.includes('row') && !n.includes('throw')) {
    return 'barbell-row';
  }
  if (n.includes('overhead-press') || n.includes('shoulder-press') || n.includes('military-press')) {
    return 'overhead-press';
  }
  if (n.includes('bench-press') || n.includes('chest-press') || n.includes('cable-fly') || n.includes('pec-deck')) {
    return 'bench-press';
  }
  if (n.includes('curl') && !n.includes('leg')) {
    return 'dumbbell-curl';
  }
  if (n.includes('pushdown') || n.includes('skull') || n.includes('tricep')) {
    return 'tricep-pushdown';
  }
  if (n.includes('plank') && n.includes('side')) return 'side-plank';
  if (n.includes('plank')) return 'plank';
  if (n.includes('crunch')) return 'crunch';
  if (n.includes('calf')) return 'calf-raise';

  return null;
}

export function sharesPatternFamily(slugA: string, slugB: string): boolean {
  const groupA = patternExclusionGroupId(slugA);
  const groupB = patternExclusionGroupId(slugB);
  return groupA != null && groupA === groupB;
}
