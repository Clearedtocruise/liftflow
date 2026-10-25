/**
 * Exercise name matching — mirrors src/lib/exerciseNameLookup.ts (keep in sync).
 *
 * `exercises.name` carries no unique constraint, so the same lift can sit in the catalog several
 * times under different spellings ("Decline Push-Ups", "Decline Pushups", "Decline Push Up").
 * History is keyed on `exercise_id`, so each row remembers its own weight and none of them
 * remembers the others' — which reads as the app forgetting what you lifted last time.
 */

export function exerciseNameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** One-word compounds the catalog stores as two words, applied per word. */
const COMPOUND_ALIASES: Record<string, string> = {
  pullup: 'pull up',
  pullups: 'pull up',
  chinup: 'chin up',
  chinups: 'chin up',
  pushup: 'push up',
  pushups: 'push up',
  situp: 'sit up',
  situps: 'sit up',
  stepup: 'step up',
  stepups: 'step up',
};

/** Singularize a single token conservatively so "rows"→"row" but "press" stays "press". */
function singularizeWord(word: string): string {
  if (word.length <= 2) return word;
  if (word.endsWith('ies') && word.length > 3) return `${word.slice(0, -3)}y`;
  if (word.endsWith('sses')) return word.slice(0, -2); // presses -> press
  if (/(ches|shes|xes|zes)$/.test(word)) return word.slice(0, -2); // crunches -> crunch
  if (word.endsWith('ss')) return word; // press, cross
  if (word.endsWith('s')) return word.slice(0, -1); // rows -> row
  return word;
}

/** Equipment shorthand plans use: "DB Rows" is the "Dumbbell Row" already in the history. */
const EQUIPMENT_ABBREVIATIONS: Record<string, string> = {
  db: 'dumbbell',
  dbs: 'dumbbell',
  bb: 'barbell',
  kb: 'kettlebell',
  kbs: 'kettlebell',
};
const EQUIPMENT_SHORTHAND: Record<string, string> = { dumbbell: 'db', barbell: 'bb', kettlebell: 'kb' };

/**
 * A dumbbell or kettlebell is loaded per hand, so "One-Arm DB Row" and "DB Row" log the same
 * weight and are the same lift's history. A barbell or cable lift done one-sided is not.
 */
function dropOneArmQualifier(words: string[]): string[] {
  if (!words.includes('dumbbell') && !words.includes('kettlebell')) return words;
  const out: string[] = [];
  for (let i = 0; i < words.length; i += 1) {
    if (/^(one|single|1)$/.test(words[i]) && words[i + 1] === 'arm') {
      i += 1;
      continue;
    }
    out.push(words[i]);
  }
  return out;
}

export function exerciseCanonicalKey(name: string): string {
  // Coaching cues follow a comma: "One-arm dumbbell row, elbow close to body".
  const base = exerciseNameKey(name.split(',')[0] ?? '');
  if (!base) return '';
  const words = base
    .split(' ')
    .filter(Boolean)
    .map((word) => EQUIPMENT_ABBREVIATIONS[word] ?? COMPOUND_ALIASES[word] ?? singularizeWord(word))
    .join(' ')
    .split(' ');
  return dropOneArmQualifier(words).join(' ');
}

/** The same key with word boundaries removed: "Lat Pulldown" == "Lat Pull Down". */
export function exerciseCompactKey(name: string): string {
  const compact = exerciseNameKey(name).replace(/\s+/g, '');
  return compact ? singularizeWord(compact) : '';
}

export function namesMatchExercise(a: string, b: string): boolean {
  const left = exerciseCanonicalKey(a);
  const right = exerciseCanonicalKey(b);
  if (left.length > 0 && left === right) return true;
  const leftCompact = exerciseCompactKey(a);
  const rightCompact = exerciseCompactKey(b);
  return leftCompact.length > 0 && leftCompact === rightCompact;
}

/**
 * A deliberately over-broad `ilike` pattern reaching every spelling of a lift: "Push-Ups" yields
 * `%push%up%`. Callers must confirm each row with `namesMatchExercise` — the pattern also matches
 * unrelated names like "Push Up Plank".
 */
export function exerciseNamePattern(name: string): string {
  const words = exerciseCanonicalKey(name).split(' ').filter(Boolean);
  if (words.length === 0) return '';
  return `%${words.join('%')}%`;
}

/**
 * Every pattern needed to reach a lift's spellings, including its equipment shorthand: the
 * catalog holds both "Dumbbell Row" and "DB Rows", and `%dumbbell%row%` finds only the first.
 */
export function exerciseNamePatterns(name: string): string[] {
  const words = exerciseCanonicalKey(name).split(' ').filter(Boolean);
  if (words.length === 0) return [];
  const full = `%${words.join('%')}%`;
  const short = `%${words.map((word) => EQUIPMENT_SHORTHAND[word] ?? word).join('%')}%`;
  return short === full ? [full] : [full, short];
}
