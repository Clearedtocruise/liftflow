import encyclopedia from './month1ExerciseEncyclopedia.json';

export type Month1EncyclopediaEntry = {
  id: number;
  name: string;
  category: string;
  muscles: string;
  howTo: string;
};

const ENTRIES = encyclopedia as Month1EncyclopediaEntry[];

const byName = new Map<string, Month1EncyclopediaEntry>();
for (const entry of ENTRIES) {
  byName.set(entry.name.toLowerCase().trim(), entry);
}

function normalizeName(name: string): string {
  return name.toLowerCase().trim();
}

export function getMonth1EncyclopediaEntry(exerciseName: string): Month1EncyclopediaEntry | null {
  const direct = byName.get(normalizeName(exerciseName));
  if (direct) return direct;

  for (const [key, entry] of byName) {
    if (key.includes(normalizeName(exerciseName)) || normalizeName(exerciseName).includes(key)) {
      return entry;
    }
  }
  return null;
}

export function month1GuideFromEncyclopedia(
  exerciseName: string,
  options?: { exactOnly?: boolean },
) {
  // Substring matching is useful for search, but unsafe for exercise instructions: a variation
  // can inherit a different movement merely because one name contains the other.
  const entry = options?.exactOnly
    ? byName.get(normalizeName(exerciseName)) ?? null
    : getMonth1EncyclopediaEntry(exerciseName);
  if (!entry) return null;

  const howTo = entry.howTo.trim();
  const sentences = howTo.split(/(?<=[.!])\s+/).filter(Boolean);

  return {
    feelLike: entry.muscles,
    setup: sentences.slice(0, 2),
    execution: sentences.slice(2, 5),
    breathing: sentences.find((s) => /inhale|exhale|breathe/i.test(s)) ?? undefined,
    cues: sentences.filter((s) => /keep|brace|drive|squeeze|control/i.test(s)).slice(0, 4),
    commonMistakes: sentences.filter((s) => /avoid|don't|do not/i.test(s)).slice(0, 3),
    regressions: sentences.filter((s) => /regress/i.test(s)).slice(0, 2),
    progressions: sentences.filter((s) => /progress/i.test(s)).slice(0, 2),
    source: 'month1_encyclopedia' as const,
  };
}

export const MONTH1_ENCYCLOPEDIA_COUNT = ENTRIES.length;
