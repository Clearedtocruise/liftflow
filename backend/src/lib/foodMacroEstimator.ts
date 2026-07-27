import { getOpenAI, hasOpenAI } from './openai.js';

export type FoodMacroEstimate = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  reasoning?: string;
};

export type FoodMacroComponent = FoodMacroEstimate & {
  name: string;
  amount?: string;
};

/** Per-oz estimates for common whole foods (scaled by the serving parser). */
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
  'rice': { calories: 37, proteinG: 0.7, carbsG: 7.5, fatG: 0.1 },
  'quinoa': { calories: 34, proteinG: 1.3, carbsG: 6, fatG: 0.5 },
  'egg': { calories: 41, proteinG: 3.6, carbsG: 0.2, fatG: 2.9 },
  'egg whites': { calories: 15, proteinG: 3, carbsG: 0.2, fatG: 0 },
  // Calorie-dense condiments: without these a tablespoon gets scaled as if it
  // were several ounces of a generic food.
  'honey': { calories: 86, proteinG: 0.1, carbsG: 23.3, fatG: 0 },
  'olive oil': { calories: 251, proteinG: 0, carbsG: 0, fatG: 28.4 },
  'almond butter': { calories: 175, proteinG: 6.1, carbsG: 5.4, fatG: 15.6 },
  'peanut butter': { calories: 168, proteinG: 7.1, carbsG: 6.1, fatG: 14.4 },
  'whey protein': { calories: 109, proteinG: 21.8, carbsG: 2.7, fatG: 1.4 },
  'rolled oats': { calories: 107, proteinG: 4.6, carbsG: 19, fatG: 2.9 },
  'banana': { calories: 25, proteinG: 0.3, carbsG: 6.4, fatG: 0.1 },
  'apple': { calories: 15, proteinG: 0.1, carbsG: 4, fatG: 0.1 },
  'berries': { calories: 17, proteinG: 0.2, carbsG: 4.2, fatG: 0.1 },
  'blueberries': { calories: 16, proteinG: 0.2, carbsG: 4.1, fatG: 0.1 },
  'broccoli': { calories: 10, proteinG: 0.8, carbsG: 2, fatG: 0.1 },
  'asparagus': { calories: 6, proteinG: 0.6, carbsG: 1.1, fatG: 0.1 },
  'spinach': { calories: 7, proteinG: 0.9, carbsG: 1.1, fatG: 0.1 },
  'mixed greens': { calories: 5, proteinG: 0.5, carbsG: 1, fatG: 0.1 },
  'mixed vegetables': { calories: 12, proteinG: 0.7, carbsG: 2.4, fatG: 0.1 },
  'almond milk': { calories: 4, proteinG: 0.1, carbsG: 0.2, fatG: 0.3 },
};

/** Fixed per-serving estimates when the food is typically logged as a container/unit. */
const FOOD_PER_SERVING: Record<string, FoodMacroEstimate> = {
  'oikos triple zero': { calories: 100, proteinG: 15, carbsG: 6, fatG: 0 },
  'triple zero greek yogurt': { calories: 100, proteinG: 15, carbsG: 6, fatG: 0 },
  'greek yogurt': { calories: 100, proteinG: 17, carbsG: 6, fatG: 0 },
};

type ServingUnit =
  | 'oz'
  | 'g'
  | 'kg'
  | 'lb'
  | 'cup'
  | 'tbsp'
  | 'tsp'
  | 'ml'
  | 'l'
  | 'scoop'
  | 'slice'
  | 'piece'
  | 'small'
  | 'medium'
  | 'large'
  | 'serving';

/** Ounces per unit for foods with no specific entry below. */
const OZ_PER_UNIT: Record<ServingUnit, number> = {
  oz: 1,
  g: 1 / 28.35,
  kg: 35.27,
  lb: 16,
  cup: 8,
  tbsp: 0.5,
  tsp: 1 / 6,
  ml: 1 / 29.57,
  l: 33.81,
  scoop: 1.1,
  slice: 1,
  piece: 3,
  small: 3,
  medium: 4,
  large: 5.5,
  serving: 4,
};

/** Per-food overrides where a unit's weight differs sharply from the generic value. */
const FOOD_UNIT_OZ: Record<string, Partial<Record<ServingUnit, number>>> = {
  'honey': { tbsp: 0.75, tsp: 0.25, cup: 12 },
  'almond butter': { tbsp: 0.57 },
  'peanut butter': { tbsp: 0.57 },
  'rolled oats': { cup: 2.8 },
  'rice': { cup: 5.5 },
  'quinoa': { cup: 6.5 },
  'egg whites': { cup: 8.6 },
  'spinach': { cup: 1 },
  'mixed greens': { cup: 0.7 },
  'broccoli': { cup: 3.1 },
  'asparagus': { cup: 4.7 },
  'berries': { cup: 5 },
  'blueberries': { cup: 5.2 },
  'mixed vegetables': { cup: 5 },
  'banana': { medium: 4.2, small: 3.3, large: 5.4 },
  'apple': { medium: 6.4, small: 5, large: 8 },
  'egg': { piece: 1.75, medium: 1.55, large: 1.75, slice: 1.75 },
};

const UNIT_PATTERNS: [ServingUnit, RegExp][] = [
  ['tbsp', /\b(tbsp|tablespoons?)\b/i],
  ['tsp', /\b(tsp|teaspoons?)\b/i],
  ['cup', /\bcups?\b/i],
  ['oz', /\b(oz|ounces?)\b/i],
  ['kg', /\b(kg|kilograms?)\b/i],
  ['g', /\b(g|grams?)\b/i],
  ['lb', /\b(lbs?|pounds?)\b/i],
  ['ml', /\b(ml|milliliters?)\b/i],
  ['l', /\b(l|liters?)\b/i],
  ['scoop', /\bscoops?\b/i],
  ['slice', /\bslices?\b/i],
  ['piece', /\b(pieces?|whole|each)\b/i],
  ['small', /\bsmall\b/i],
  ['medium', /\b(medium|med)\b/i],
  ['large', /\blarge\b/i],
  ['serving', /\bservings?\b/i],
];

function normalizeFood(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ');
}

/** Handles decimals, simple fractions and mixed numbers ("1 1/2"). */
function parseAmount(servingSize: string): number | null {
  const mixed = servingSize.match(/(\d+)\s+(\d+)\s*\/\s*(\d+)/);
  if (mixed) {
    const whole = Number(mixed[1]);
    const denominator = Number(mixed[3]);
    if (denominator > 0) return whole + Number(mixed[2]) / denominator;
  }

  const fraction = servingSize.match(/(\d+)\s*\/\s*(\d+)/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    if (denominator > 0) return Number(fraction[1]) / denominator;
  }

  const decimal = servingSize.match(/(\d+(?:\.\d+)?)/);
  if (decimal) return Number(decimal[1]);

  return null;
}

function parseUnit(servingSize: string): ServingUnit | null {
  for (const [unit, pattern] of UNIT_PATTERNS) {
    if (pattern.test(servingSize)) return unit;
  }
  return null;
}

function roundMacros(base: FoodMacroEstimate): FoodMacroEstimate {
  return {
    calories: Math.round(base.calories),
    proteinG: Math.round(base.proteinG * 10) / 10,
    carbsG: Math.round(base.carbsG * 10) / 10,
    fatG: Math.round(base.fatG * 10) / 10,
    reasoning: base.reasoning,
  };
}

function scaleMacros(base: FoodMacroEstimate, multiplier: number): FoodMacroEstimate {
  return roundMacros({
    calories: base.calories * multiplier,
    proteinG: base.proteinG * multiplier,
    carbsG: base.carbsG * multiplier,
    fatG: base.fatG * multiplier,
    reasoning: base.reasoning,
  });
}

function lookupFoodKey(foodName: string): string | null {
  const key = normalizeFood(foodName);
  if (FOOD_PER_OZ[key]) return key;

  // Longest match first so "lean ground beef" wins over "ground beef".
  const patterns = Object.keys(FOOD_PER_OZ).sort((a, b) => b.length - a.length);
  return patterns.find((pattern) => key.includes(pattern)) ?? null;
}

function lookupServingFood(foodName: string): FoodMacroEstimate | null {
  const key = normalizeFood(foodName);
  const patterns = Object.keys(FOOD_PER_SERVING).sort((a, b) => b.length - a.length);
  const match = patterns.find((pattern) => key.includes(pattern));
  return match ? FOOD_PER_SERVING[match] : null;
}

/** Ounces described by a serving string, using per-food unit weights where known. */
function servingSizeInOunces(foodKey: string | null, servingSize: string): number | null {
  const amount = parseAmount(servingSize);
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return null;

  const unit = parseUnit(servingSize);
  if (!unit) return amount * OZ_PER_UNIT.serving;

  const perFood = foodKey ? FOOD_UNIT_OZ[foodKey]?.[unit] : undefined;
  return amount * (perFood ?? OZ_PER_UNIT[unit]);
}

function parentheticalCalories(chunk: string): number | null {
  const match = chunk.match(/\((\d+)\s*cal(?:ories)?\)/i);
  return match ? Number(match[1]) : null;
}

/** Split "yogurt, blueberries, and peanut butter" into individual foods. */
export function splitFoodItems(foodName: string): string[] {
  return foodName
    .split(/\s*,\s*|\s+and\s+/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function sumMacroComponents(components: FoodMacroComponent[]): FoodMacroEstimate {
  return roundMacros(
    components.reduce(
      (acc, part) => ({
        calories: acc.calories + part.calories,
        proteinG: acc.proteinG + part.proteinG,
        carbsG: acc.carbsG + part.carbsG,
        fatG: acc.fatG + part.fatG,
      }),
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    ),
  );
}

export function formatMacroReasoning(components: FoodMacroComponent[], totals: FoodMacroEstimate): string {
  const lines = components.map((part) => {
    const amount = part.amount ? ` (${part.amount})` : '';
    return `${part.name}${amount}: ${part.calories} cal, ${part.proteinG}g protein, ${part.carbsG}g carbs, ${part.fatG}g fat.`;
  });
  lines.push(
    `Total: ${totals.calories} calories, ${totals.proteinG}g protein, ${totals.carbsG}g carbs, and ${totals.fatG}g fat.`,
  );
  return lines.join(' ');
}

/**
 * If the model narrated per-food macros that do not add up to the headline totals,
 * trust the component math and rewrite the closing total so the UI cannot disagree with itself.
 */
export function reconcileFoodMacroEstimate(estimate: FoodMacroEstimate): FoodMacroEstimate {
  const reasoning = estimate.reasoning?.trim();
  if (!reasoning) return roundMacros(estimate);

  const componentPattern =
    /(\d+(?:\.\d+)?)\s*calories?,\s*(\d+(?:\.\d+)?)\s*g(?:rams)?\s*of\s*protein,\s*(\d+(?:\.\d+)?)\s*g(?:rams)?\s*of\s*carbs?,\s*(?:and\s*)?(\d+(?:\.\d+)?)\s*g(?:rams)?\s*of\s*fat/gi;

  const components: FoodMacroEstimate[] = [];
  for (const match of reasoning.matchAll(componentPattern)) {
    components.push({
      calories: Number(match[1]),
      proteinG: Number(match[2]),
      carbsG: Number(match[3]),
      fatG: Number(match[4]),
    });
  }

  // Need the itemized lines, not just the closing "total" sentence.
  if (components.length < 2) return roundMacros(estimate);

  const itemized = components.slice(0, -1);
  const summed = roundMacros(
    itemized.reduce(
      (acc, part) => ({
        calories: acc.calories + part.calories,
        proteinG: acc.proteinG + part.proteinG,
        carbsG: acc.carbsG + part.carbsG,
        fatG: acc.fatG + part.fatG,
      }),
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    ),
  );

  const headline = roundMacros(estimate);
  const disagrees =
    Math.abs(summed.calories - headline.calories) > 5 ||
    Math.abs(summed.proteinG - headline.proteinG) > 1 ||
    Math.abs(summed.carbsG - headline.carbsG) > 1 ||
    Math.abs(summed.fatG - headline.fatG) > 1;

  if (!disagrees) return headline;

  const cleaned = reasoning
    .replace(
      /Combining these estimates gives a total of approximately[^.]*\./i,
      `Combining these estimates gives a total of approximately ${summed.calories} calories, ${summed.proteinG}g of protein, ${summed.carbsG}g of carbs, and ${summed.fatG}g of fat.`,
    )
    .replace(
      /Total:\s*[^.]*\./i,
      `Total: ${summed.calories} calories, ${summed.proteinG}g protein, ${summed.carbsG}g carbs, and ${summed.fatG}g fat.`,
    );

  return { ...summed, reasoning: cleaned };
}

export function estimateFoodMacrosLocal(foodName: string, servingSize: string): FoodMacroEstimate {
  const items = splitFoodItems(foodName);
  if (items.length > 1) {
    const components = items.map((item) => {
      const estimated = estimateSingleFoodLocal(item, inferItemServing(item, servingSize));
      return { name: item, amount: inferItemServing(item, servingSize), ...estimated };
    });
    const totals = sumMacroComponents(components);
    return { ...totals, reasoning: formatMacroReasoning(components, totals) };
  }

  return estimateSingleFoodLocal(foodName, servingSize);
}

function inferItemServing(item: string, fallbackServing: string): string {
  if (/\b(cup|tbsp|tsp|oz|g|scoop|slice|serving)s?\b/i.test(item)) return item;
  if (parentheticalCalories(item) != null) return '1 serving';
  if (/peanut(?:\s+butter)?/i.test(item) || /almond butter/i.test(item)) return '1 tbsp';
  if (/blueberr|berr/i.test(item)) return '1 cup';
  if (/yogurt/i.test(item)) return '1 serving';
  return fallbackServing;
}

function estimateSingleFoodLocal(foodName: string, servingSize: string): FoodMacroEstimate {
  const hintedCalories = parentheticalCalories(foodName);
  const perServing = lookupServingFood(foodName);
  if (perServing) {
    const amount = parseAmount(servingSize) ?? 1;
    const scaled = scaleMacros(perServing, amount);
    if (hintedCalories != null && amount === 1) {
      return { ...scaled, calories: hintedCalories };
    }
    return scaled;
  }

  const key = lookupFoodKey(foodName);
  const base = key ? FOOD_PER_OZ[key] : { calories: 50, proteinG: 5, carbsG: 3, fatG: 2 };
  const ounces = servingSizeInOunces(key, servingSize);
  const scaled = scaleMacros(base, ounces ?? OZ_PER_UNIT.serving);
  if (hintedCalories != null && (parseAmount(servingSize) ?? 1) === 1 && !parseUnit(servingSize)) {
    return { ...scaled, calories: hintedCalories };
  }
  return scaled;
}

type AiFoodMacroResponse = FoodMacroEstimate & {
  components?: Array<{
    name?: string;
    amount?: string;
    calories?: number;
    proteinG?: number;
    carbsG?: number;
    fatG?: number;
  }>;
};

async function callOpenAiFoodMacros(foodName: string, servingSize: string): Promise<FoodMacroEstimate | null> {
  const openai = getOpenAI();
  if (!openai || !hasOpenAI()) return null;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You are a nutrition estimator. Return JSON only: { components: [{ name, amount, calories, proteinG, carbsG, fatG }], calories, proteinG, carbsG, fatG, reasoning }. ' +
          'Split multi-food inputs into components. calories/proteinG/carbsG/fatG MUST equal the exact arithmetic sum of components (round calories to integer, macros to 1 decimal). ' +
          'reasoning must list each component then restate that same summed total — never invent a different total.',
      },
      {
        role: 'user',
        content: JSON.stringify({ foodName, servingSize }),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) return null;
  const parsed = JSON.parse(content) as AiFoodMacroResponse;

  const components = (parsed.components ?? [])
    .map((part) => {
      if (part.calories == null || part.proteinG == null) return null;
      return {
        name: part.name?.trim() || 'Item',
        amount: part.amount,
        calories: Math.round(part.calories),
        proteinG: Math.round((part.proteinG ?? 0) * 10) / 10,
        carbsG: Math.round((part.carbsG ?? 0) * 10) / 10,
        fatG: Math.round((part.fatG ?? 0) * 10) / 10,
      } satisfies FoodMacroComponent;
    })
    .filter((part): part is FoodMacroComponent => part != null);

  if (components.length > 0) {
    const totals = sumMacroComponents(components);
    return {
      ...totals,
      reasoning: formatMacroReasoning(components, totals),
    };
  }

  if (parsed.calories == null || parsed.proteinG == null) return null;
  return reconcileFoodMacroEstimate({
    calories: Math.round(parsed.calories),
    proteinG: Math.round(parsed.proteinG * 10) / 10,
    carbsG: Math.round((parsed.carbsG ?? 0) * 10) / 10,
    fatG: Math.round((parsed.fatG ?? 0) * 10) / 10,
    reasoning: parsed.reasoning,
  });
}

export async function estimateFoodMacros(
  foodName: string,
  servingSize: string,
): Promise<FoodMacroEstimate> {
  const ai = await callOpenAiFoodMacros(foodName, servingSize);
  if (ai) {
    return reconcileFoodMacroEstimate({
      ...ai,
      reasoning: ai.reasoning ?? `Estimated macros for ${foodName} (${servingSize}).`,
    });
  }

  const local = estimateFoodMacrosLocal(foodName, servingSize);
  return {
    ...local,
    reasoning: local.reasoning ?? `Rule-based estimate for ${foodName} (${servingSize}). Review before saving.`,
  };
}
