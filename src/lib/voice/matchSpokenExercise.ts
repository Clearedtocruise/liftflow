/**
 * Deciding whether a spoken exercise name refers to the exercise currently on screen.
 *
 * Transcription returns what the lifter said, not what the exercise is called in the catalog.
 * "bench press" against a session holding "Barbell Bench Press" is the same lift; "incline bench
 * press" against "Decline Bench Press" is not. String equality treats both as a miss.
 */

/** Words that name the implement rather than the movement, and are routinely left unsaid. */
const IMPLEMENT_WORDS = new Set([
  'assisted',
  'band',
  'banded',
  'bar',
  'barbell',
  'bodyweight',
  'cable',
  'dumbbell',
  'ez',
  'kettlebell',
  'landmine',
  'lever',
  'machine',
  'plate',
  'sled',
  'smith',
  'weighted',
]);

/** Articles and connectives that carry no meaning for matching. */
const FILLER_WORDS = new Set(['a', 'an', 'and', 'for', 'of', 'on', 'over', 'the', 'to', 'with']);

/**
 * Qualifier families whose members are mutually exclusive. Two names that pick different members of
 * the same family are different exercises however much else they share. Kept deliberately narrow:
 * a family that accidentally pairs two synonyms (side/lateral, close/narrow) would reject matches
 * that ought to succeed, which is the bug this module exists to fix.
 */
const EXCLUSIVE_QUALIFIER_GROUPS: string[][] = [
  ['incline', 'decline', 'flat'],
  ['front', 'back'],
  ['romanian', 'stiff', 'conventional', 'sumo', 'deficit'],
  ['seated', 'standing', 'lying', 'kneeling', 'bent'],
  ['close', 'wide'],
  ['high', 'low', 'mid'],
  ['reverse', 'forward'],
];

/** Shorthand that speech-to-text preserves verbatim but the catalog spells out. */
const ABBREVIATIONS: Record<string, string> = {
  bb: 'barbell',
  bw: 'bodyweight',
  db: 'dumbbell',
  gm: 'good morning',
  kb: 'kettlebell',
  ohp: 'overhead press',
  rdl: 'romanian deadlift',
  sldl: 'stiff leg deadlift',
};

/** Spelling variants of a single movement word. */
const TOKEN_SYNONYMS: Record<string, string> = {
  flye: 'fly',
  extention: 'extension',
  pressdown: 'pushdown',
};

/**
 * Movement names that are written as one word in some sources and two in others. Transcription
 * picks whichever it likes, so both spellings are folded to the joined form.
 */
const COMPOUND_PAIRS = new Map<string, string>([
  ['pull down', 'pulldown'],
  ['push down', 'pushdown'],
  ['pull up', 'pullup'],
  ['chin up', 'chinup'],
  ['push up', 'pushup'],
  ['sit up', 'situp'],
  ['step up', 'stepup'],
  ['pull over', 'pullover'],
  ['kick back', 'kickback'],
  ['dead lift', 'deadlift'],
  ['good morning', 'goodmorning'],
  ['face pull', 'facepull'],
]);

/**
 * Plurals only. "press" must keep both esses; "ups" must lose its s so that "pull ups" reaches the
 * compound form. Both names run through this, so a word it trims oddly still compares equal.
 */
function singularize(token: string): string {
  if (token.length <= 2) return token;
  if (token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  if (token.endsWith('sses') || token.endsWith('shes') || token.endsWith('ches')) {
    return token.slice(0, -2);
  }
  if (token.endsWith('ss') || token.endsWith('us') || token.endsWith('is')) return token;
  if (token.endsWith('s')) return token.slice(0, -1);
  return token;
}

function joinCompounds(tokens: string[]): string[] {
  const joined: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const pair = `${tokens[index]} ${tokens[index + 1] ?? ''}`;
    const compound = COMPOUND_PAIRS.get(pair);
    if (compound) {
      joined.push(compound);
      index += 1;
      continue;
    }
    joined.push(tokens[index]!);
  }
  return joined;
}

function tokenize(name: string): string[] {
  const tokens = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((token) => (ABBREVIATIONS[token] ?? token).split(' '))
    .map(singularize)
    .map((token) => TOKEN_SYNONYMS[token] ?? token);
  return joinCompounds(tokens);
}

/**
 * The tokens that identify the movement: what is left after dropping implement and filler words.
 * A name made only of implement words keeps its full token list, so "Kettlebell" does not reduce to
 * nothing and then match everything.
 */
function coreTokens(name: string): string[] {
  const tokens = tokenize(name);
  const core = tokens.filter((token) => !IMPLEMENT_WORDS.has(token) && !FILLER_WORDS.has(token));
  return core.length > 0 ? core : tokens;
}

function hasConflictingQualifier(a: string[], b: string[]): boolean {
  return EXCLUSIVE_QUALIFIER_GROUPS.some((group) => {
    const fromA = group.find((word) => a.includes(word));
    const fromB = group.find((word) => b.includes(word));
    return fromA != null && fromB != null && fromA !== fromB;
  });
}

function isSubset(inner: string[], outer: string[]): boolean {
  return inner.every((token) => outer.includes(token));
}

export type SpokenExerciseMatch =
  /** The two names denote the same exercise. */
  | { kind: 'exact' }
  /**
   * One name is the other with implement or qualifier words dropped: an abbreviation of the
   * exercise on screen, or the same lift under the catalog's longer spelling.
   */
  | { kind: 'related' }
  /** Different exercises. `reason` is written to be shown to the lifter. */
  | { kind: 'different'; reason: string };

/**
 * Compares a spoken exercise name against the exercise a screen is currently logging to.
 *
 * `related` is a match, not a near miss. Voice logging only ever writes to the active exercise, so
 * the caller should accept it and name the exercise the set landed on rather than refuse the save.
 */
export function matchSpokenExercise(spoken: string, active: string): SpokenExerciseMatch {
  const spokenCore = coreTokens(spoken);
  const activeCore = coreTokens(active);

  if (spokenCore.length === 0 || activeCore.length === 0) {
    return { kind: 'different', reason: `${active.trim()} is the current exercise.` };
  }

  if (spokenCore.join(' ') === activeCore.join(' ')) return { kind: 'exact' };

  if (
    !hasConflictingQualifier(spokenCore, activeCore) &&
    (isSubset(spokenCore, activeCore) || isSubset(activeCore, spokenCore))
  ) {
    return { kind: 'related' };
  }

  return {
    kind: 'different',
    reason: `Heard "${spoken.trim()}", but ${active.trim()} is the current exercise.`,
  };
}
