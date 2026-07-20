import { getOpenAI, hasOpenAI } from './openai.js';

export type ExerciseSearchSuggestion = {
  name: string;
  slug: string;
  equipment: string;
  muscleGroups: string[];
  exerciseType: 'strength' | 'bodyweight' | 'timed' | 'cardio';
  reason: string;
  source: 'ai' | 'web';
};

type CacheEntry = {
  expiresAt: number;
  suggestions: ExerciseSearchSuggestion[];
};

const CACHE_TTL_MS = 5 * 60_000;
const cache = new Map<string, CacheEntry>();

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeSuggestion(raw: Partial<ExerciseSearchSuggestion>): ExerciseSearchSuggestion | null {
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name || name.length < 2) return null;
  const equipment =
    typeof raw.equipment === 'string' && raw.equipment.trim() ? raw.equipment.trim().toLowerCase() : 'other';
  const muscleGroups = Array.isArray(raw.muscleGroups)
    ? raw.muscleGroups.filter((item): item is string => typeof item === 'string').slice(0, 4)
    : ['general'];
  const exerciseType =
    raw.exerciseType === 'bodyweight' ||
    raw.exerciseType === 'timed' ||
    raw.exerciseType === 'cardio' ||
    raw.exerciseType === 'strength'
      ? raw.exerciseType
      : 'strength';
  return {
    name,
    slug: typeof raw.slug === 'string' && raw.slug.trim() ? slugify(raw.slug) : slugify(name),
    equipment,
    muscleGroups: muscleGroups.length ? muscleGroups : ['general'],
    exerciseType,
    reason:
      typeof raw.reason === 'string' && raw.reason.trim()
        ? raw.reason.trim()
        : 'Suggested match for your search.',
    source: raw.source === 'web' ? 'web' : 'ai',
  };
}

async function searchViaResponsesApi(
  query: string,
  limit: number,
  availableEquipment?: string[],
): Promise<ExerciseSearchSuggestion[] | null> {
  const openai = getOpenAI();
  if (!openai || !hasOpenAI()) return null;

  const equipmentHint =
    availableEquipment && availableEquipment.length > 0
      ? `Prefer equipment from: ${availableEquipment.join(', ')}.`
      : 'Assume a typical commercial gym.';

  try {
    // Prefer web-backed search when the SDK/account supports it.
    const response = await (openai as unknown as {
      responses: {
        create: (body: Record<string, unknown>) => Promise<{ output_text?: string; output?: unknown }>;
      };
    }).responses.create({
      model: 'gpt-4o-mini',
      tools: [{ type: 'web_search_preview' }],
      input: [
        {
          role: 'system',
          content:
            'You help gym-goers find real exercise names. Search the web when unsure. Return JSON only: {"suggestions":[{"name","equipment","muscleGroups","exerciseType","reason","source"}]}. exerciseType must be strength|bodyweight|timed|cardio. source must be web or ai. Max ' +
            String(limit) +
            ' suggestions.',
        },
        {
          role: 'user',
          content: `Find gym exercises matching: "${query}". ${equipmentHint}`,
        },
      ],
    });

    const text =
      typeof response.output_text === 'string'
        ? response.output_text
        : JSON.stringify(response.output ?? {});
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as { suggestions?: Partial<ExerciseSearchSuggestion>[] };
    return (parsed.suggestions ?? [])
      .map((item) => normalizeSuggestion({ ...item, source: item.source === 'ai' ? 'ai' : 'web' }))
      .filter((item): item is ExerciseSearchSuggestion => item != null)
      .slice(0, limit);
  } catch {
    return null;
  }
}

async function searchViaChatCompletions(
  query: string,
  limit: number,
  availableEquipment?: string[],
): Promise<ExerciseSearchSuggestion[]> {
  const openai = getOpenAI();
  if (!openai || !hasOpenAI()) return [];

  const equipmentHint =
    availableEquipment && availableEquipment.length > 0
      ? `Prefer equipment from: ${availableEquipment.join(', ')}.`
      : 'Assume a typical commercial gym.';

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a strength-training exercise librarian with up-to-date knowledge of common gym machines and movements (including brand-specific cables/machines).
Return JSON only: {"suggestions":[{"name":string,"equipment":string,"muscleGroups":string[],"exerciseType":"strength"|"bodyweight"|"timed"|"cardio","reason":string,"source":"ai"|"web"}]}.
Rules:
- Suggest real, searchable exercise names people would find online or on gym placards.
- Prefer exact matches for partial machine names (e.g. "hammer low" → "Hammer Low Row").
- Max ${limit} suggestions, ranked best-first.
- No medical claims.`,
      },
      {
        role: 'user',
        content: `Query: "${query}". ${equipmentHint}`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) return [];
  const parsed = JSON.parse(content) as { suggestions?: Partial<ExerciseSearchSuggestion>[] };
  return (parsed.suggestions ?? [])
    .map((item) => normalizeSuggestion(item))
    .filter((item): item is ExerciseSearchSuggestion => item != null)
    .slice(0, limit);
}

/** AI/online exercise typeahead. Cached briefly to protect latency and cost. */
export async function searchExercisesOnline(input: {
  query: string;
  limit?: number;
  availableEquipment?: string[];
}): Promise<ExerciseSearchSuggestion[]> {
  const query = normalizeQuery(input.query);
  if (query.length < 2) return [];

  const limit = Math.min(Math.max(input.limit ?? 5, 1), 8);
  const cacheKey = `${query}|${limit}|${(input.availableEquipment ?? []).slice().sort().join(',')}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.suggestions;
  }

  const fromWeb = await searchViaResponsesApi(query, limit, input.availableEquipment);
  const suggestions =
    fromWeb && fromWeb.length > 0
      ? fromWeb
      : await searchViaChatCompletions(query, limit, input.availableEquipment);

  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, suggestions });
  return suggestions;
}
