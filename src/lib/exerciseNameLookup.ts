/**
 * Catalog lookup has to treat "Pull-Up", "Pull Up", "Pull Ups" and slug `pull-up` as the same
 * lift. Exact-name matching dropped hyphenated plan names when the catalog used spaces, then
 * creating a custom row failed on the unique slug — so the session started on the next
 * exercise with no sets logged. Plural spellings (Pull Ups, Barbell Rows) re-broke it the same
 * way, so matching is now singular- and hyphen-insensitive.
 */

export function exerciseNameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function exerciseSlugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * One-word compounds the catalog stores as two words. Checked before singularization so
 * "Pullups" and "Pull-Ups" both collapse onto the catalog "Pull Up".
 */
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
  signup: 'sign up',
};

/** Singularize a single token conservatively so "rows"→"row" but "press" stays "press". */
function singularizeWord(word: string): string {
  if (word.length <= 2) return word;
  if (word.endsWith('ies') && word.length > 3) return `${word.slice(0, -3)}y`;
  if (word.endsWith('sses')) return word.slice(0, -2); // presses -> press
  if (/(ches|shes|xes|zes)$/.test(word)) return word.slice(0, -2); // crunches -> crunch
  if (word.endsWith('ss')) return word; // press, cross
  if (word.endsWith('s')) return word.slice(0, -1); // rows -> row, raises -> raise
  return word;
}

/**
 * A canonical, comparison-only key: lowercased, punctuation flattened to spaces, each word
 * singularized, and known one-word compounds expanded. Two names that describe the same lift
 * produce the same canonical key regardless of hyphens, spacing or plurality.
 */
export function exerciseCanonicalKey(name: string): string {
  const base = exerciseNameKey(name);
  if (!base) return '';
  const compact = base.replace(/\s+/g, '');
  if (COMPOUND_ALIASES[compact]) return COMPOUND_ALIASES[compact];
  return base
    .split(' ')
    .filter(Boolean)
    .map(singularizeWord)
    .join(' ');
}

export function namesMatchExercise(a: string, b: string): boolean {
  const left = exerciseCanonicalKey(a);
  const right = exerciseCanonicalKey(b);
  return left.length > 0 && left === right;
}

/**
 * Names to try against `exercises.name` before falling back to slug. Adds the spaced spelling
 * (catalog stores "Pull Up") and the singularized spelling ("Pull Ups" → "Pull Up") so a plural
 * or hyphenated plan name still resolves to the seeded catalog row.
 */
export function exerciseNameLookupCandidates(name: string): string[] {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (!trimmed) return [];
  const spaced = trimmed.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();

  const unique: string[] = [trimmed];
  const push = (value: string) => {
    if (value && !unique.some((existing) => existing.toLowerCase() === value.toLowerCase())) {
      unique.push(value);
    }
  };

  push(spaced);

  // Singularized spaced form: "Pull Ups" -> "Pull Up", "Barbell Rows" -> "Barbell Row".
  const singularized = spaced
    .split(' ')
    .filter(Boolean)
    .map((word, index, words) => (index === words.length - 1 ? singularizeWord(word.toLowerCase()) : word))
    .join(' ');
  if (singularized.toLowerCase() !== spaced.toLowerCase()) {
    // Preserve original casing on all but the singularized last word.
    const words = spaced.split(' ');
    words[words.length - 1] = singularizeWord(words[words.length - 1]);
    push(words.join(' '));
  }

  // One-word compound alias ("Pullups" -> "Pull Up").
  const compact = exerciseNameKey(trimmed).replace(/\s+/g, '');
  if (COMPOUND_ALIASES[compact]) push(COMPOUND_ALIASES[compact]);

  return unique;
}
