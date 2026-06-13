import { getOpenAI, hasOpenAI } from './openai.js';

export type FoodMacroEstimate = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  reasoning?: string;
};

/** Per-oz estimates for common whole foods (scaled by serving parser). */
const FOOD_PER_OZ: Record<string, FoodMacroEstimate> = {
  'chicken breast': { calories: 47, proteinG: 8.8, carbsG: 0, fatG: 1 },
  'lean ground beef': { calories: 60, proteinG: 7, carbsG: 0, fatG: 3.3 },
  'ground beef': { calories: 72, proteinG: 7.2, carbsG: 0, fatG: 4.5 },
  'salmon': { calories: 58, proteinG: 7, carbsG: 0, fatG: 3.5 },
  'turkey breast': { calories: 45, proteinG: 8.5, carbsG: 0, fatG: 0.8 },
  'white fish': { calories: 35, proteinG: 7.5, carbsG: 0, fatG: 0.5 },
  'cod': { calories: 30, proteinG: 6.5, carbsG: 0, fatG: 0.3 },
  'tofu': { calories: 22, proteinG: 2.3, carbsG: 0.6, fatG: 1.3 },
  'greek yogurt': { calories: 17, proteinG: 1.5, carbsG: 0.8, fatG: 0.2 },
  'egg': { calories: 72, proteinG: 6.3, carbsG: 0.4, fatG: 5, reasoning: 'per large egg' },
  'rice': { calories: 37, proteinG: 0.7, carbsG: 7.5, fatG: 0.1 },
  'quinoa': { calories: 34, proteinG: 1.3, carbsG: 6, fatG: 0.5 },
};

function normalizeFood(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseOz(servingSize: string): number | null {
  const match = servingSize.match(/([\d./]+)\s*oz/i);
  if (!match) return null;
  const raw = match[1];
  if (raw.includes('/')) {
    const [a, b] = raw.split('/');
    return Number(a) / Number(b || 1);
  }
  return Number(raw);
}

function parseCount(servingSize: string, unit: string): number | null {
  const match = servingSize.match(new RegExp(`([\\d./]+)\\s*${unit}`, 'i'));
  if (!match) return null;
  const raw = match[1];
  if (raw.includes('/')) {
    const [a, b] = raw.split('/');
    return Number(a) / Number(b || 1);
  }
  return Number(raw);
}

function scaleMacros(base: FoodMacroEstimate, multiplier: number): FoodMacroEstimate {
  return {
    calories: Math.round(base.calories * multiplier),
    proteinG: Math.round(base.proteinG * multiplier * 10) / 10,
    carbsG: Math.round(base.carbsG * multiplier * 10) / 10,
    fatG: Math.round(base.fatG * multiplier * 10) / 10,
    reasoning: base.reasoning,
  };
}

function lookupFoodKey(foodName: string): string | null {
  const key = normalizeFood(foodName);
  if (FOOD_PER_OZ[key]) return key;
  for (const pattern of Object.keys(FOOD_PER_OZ)) {
    if (key.includes(pattern) || pattern.includes(key)) return pattern;
  }
  return null;
}

export function estimateFoodMacrosLocal(foodName: string, servingSize: string): FoodMacroEstimate {
  const key = lookupFoodKey(foodName);
  const base = key ? FOOD_PER_OZ[key] : { calories: 50, proteinG: 5, carbsG: 3, fatG: 2 };

  const oz = parseOz(servingSize);
  if (oz != null) {
    if (key === 'egg') {
      return scaleMacros(base, oz / 1.75);
    }
    return scaleMacros(base, oz);
  }

  const cups = parseCount(servingSize, 'cup');
  if (cups != null && (key === 'rice' || key === 'quinoa')) {
    return scaleMacros(base, cups * 8);
  }

  const tbsp = parseCount(servingSize, 'tbsp');
  if (tbsp != null) {
    return scaleMacros({ calories: 40, proteinG: 0, carbsG: 0, fatG: 4.5 }, tbsp);
  }

  const scoop = parseCount(servingSize, 'scoop');
  if (scoop != null) {
    return scaleMacros({ calories: 120, proteinG: 24, carbsG: 3, fatG: 1.5 }, scoop);
  }

  return scaleMacros(base, 6);
}

async function callOpenAiFoodMacros(foodName: string, servingSize: string): Promise<FoodMacroEstimate | null> {
  const openai = getOpenAI();
  if (!openai || !hasOpenAI()) return null;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You are a nutrition estimator. Return JSON only: { calories, proteinG, carbsG, fatG, reasoning }. Estimate macros for the exact food and serving. Round calories to integer, macros to 1 decimal.',
      },
      {
        role: 'user',
        content: JSON.stringify({ foodName, servingSize }),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) return null;
  const parsed = JSON.parse(content) as FoodMacroEstimate;
  if (parsed.calories == null || parsed.proteinG == null) return null;
  return {
    calories: Math.round(parsed.calories),
    proteinG: Math.round(parsed.proteinG * 10) / 10,
    carbsG: Math.round((parsed.carbsG ?? 0) * 10) / 10,
    fatG: Math.round((parsed.fatG ?? 0) * 10) / 10,
    reasoning: parsed.reasoning,
  };
}

export async function estimateFoodMacros(
  foodName: string,
  servingSize: string,
): Promise<FoodMacroEstimate> {
  const ai = await callOpenAiFoodMacros(foodName, servingSize);
  if (ai) {
    return {
      ...ai,
      reasoning: ai.reasoning ?? `Estimated macros for ${foodName} (${servingSize}).`,
    };
  }

  const local = estimateFoodMacrosLocal(foodName, servingSize);
  return {
    ...local,
    reasoning: `Rule-based estimate for ${foodName} (${servingSize}). Review before saving.`,
  };
}
