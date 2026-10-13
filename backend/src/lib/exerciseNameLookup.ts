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

export function exerciseCanonicalKey(name: string): string {
  const base = exerciseNameKey(name);
  if (!base) return '';
  return base
    .split(' ')
    .filter(Boolean)
    .map((word) => COMPOUND_ALIASES[word] ?? singularizeWord(word))
    .join(' ');
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
