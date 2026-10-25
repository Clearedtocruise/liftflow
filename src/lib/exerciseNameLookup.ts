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
 * One-word compounds the catalog stores as two words. Applied per word, so "Decline Pushups"
 * collapses onto "Decline Push Up" and not just the bare "Pushups".
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

/**
 * The same key with word boundaries removed, so a lift split differently in two places still
 * matches: "Lat Pulldown" == "Lat Pull Down", "Deadlift" == "Dead Lift". The catalog has no
 * unique constraint on `name`, so these really do coexist as separate rows with separate history.
 */
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
 * `%push%up%`, which finds "Push Up", "Pushups" and "Push-Up" in one query. Callers must confirm
 * each row with `namesMatchExercise` — the pattern also matches "Push Up Plank".
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
