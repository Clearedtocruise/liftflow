import { getOpenAI, hasOpenAI } from './openai.js';

export type FoodMacroEstimate = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  reasoning?: string;
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
  // Nonfat high-protein yogurt cups (Oikos Triple Zero ≈ 90 kcal / 5.3 oz).
  'oikos triple zero': { calories: 17, proteinG: 2.8, carbsG: 1.1, fatG: 0 },
  'oikos': { calories: 17, proteinG: 2.8, carbsG: 1.1, fatG: 0 },
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
  'peanuts': { calories: 160, proteinG: 7.3, carbsG: 4.6, fatG: 14 },
  'whey protein': { calories: 109, proteinG: 21.8, carbsG: 2.7, fatG: 1.4 },
  'rolled oats': { calories: 107, proteinG: 4.6, carbsG: 19, fatG: 2.9 },
  'oatmeal': { calories: 107, proteinG: 4.6, carbsG: 19, fatG: 2.9 },
  'banana': { calories: 25, proteinG: 0.3, carbsG: 6.4, fatG: 0.1 },
  'apple': { calories: 15, proteinG: 0.1, carbsG: 4, fatG: 0.1 },
  'berries': { calories: 17, proteinG: 0.2, carbsG: 4.2, fatG: 0.1 },
  'blueberries': { calories: 17, proteinG: 0.2, carbsG: 4.2, fatG: 0.1 },
  'broccoli': { calories: 10, proteinG: 0.8, carbsG: 2, fatG: 0.1 },
  'asparagus': { calories: 6, proteinG: 0.6, carbsG: 1.1, fatG: 0.1 },
  'spinach': { calories: 7, proteinG: 0.9, carbsG: 1.1, fatG: 0.1 },
  'mixed greens': { calories: 5, proteinG: 0.5, carbsG: 1, fatG: 0.1 },
  'mixed vegetables': { calories: 12, proteinG: 0.7, carbsG: 2.4, fatG: 0.1 },
  'almond milk': { calories: 4, proteinG: 0.1, carbsG: 0.2, fatG: 0.3 },
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
  | 'serving'
  | 'container';

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
  container: 5.3,
};

/** Per-food overrides where a unit's weight differs sharply from the generic value. */
const FOOD_UNIT_OZ: Record<string, Partial<Record<ServingUnit, number>>> = {
  'honey': { tbsp: 0.75, tsp: 0.25, cup: 12 },
  'almond butter': { tbsp: 0.57 },
  'peanut butter': { tbsp: 0.57 },
  'peanuts': { tbsp: 0.32, cup: 5.1 },
  'rolled oats': { cup: 2.8 },
  'oatmeal': { cup: 2.8, serving: 1.4 },
  'rice': { cup: 5.5 },
  'quinoa': { cup: 6.5 },
  'egg whites': { cup: 8.6 },
  'spinach': { cup: 1 },
  'mixed greens': { cup: 0.7 },
  'broccoli': { cup: 3.1 },
  'asparagus': { cup: 4.7 },
  'berries': { cup: 5, serving: 2.5 },
  'blueberries': { cup: 5.2, serving: 2.6 },
  'mixed vegetables': { cup: 5 },
  'banana': { medium: 4.2, small: 3.3, large: 5.4 },
  'apple': { medium: 6.4, small: 5, large: 8 },
  'egg': { piece: 1.75, medium: 1.55, large: 1.75, slice: 1.75 },
  'greek yogurt': { cup: 8.6, container: 5.3, serving: 5.3 },
  'oikos triple zero': { cup: 5.3, container: 5.3, serving: 5.3 },
  'oikos': { cup: 5.3, container: 5.3, serving: 5.3 },
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
  ['container', /\bcontainers?\b/i],
  ['serving', /\bservings?\b/i],
];

const EMBEDDED_SERVING_RE =
  /^((?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s*(?:tbsp|tablespoons?|tsp|teaspoons?|cups?|oz|ounces?|g|grams?|kg|kilograms?|lbs?|pounds?|ml|milliliters?|l|liters?|scoops?|slices?|pieces?|containers?|medium|large|small|servings?)(?:\s+of)?)\s+(.+)$/i;

const TRAILING_SERVING_RE =
  /^(.+?)\s+((?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s*(?:tbsp|tablespoons?|tsp|teaspoons?|cups?|oz|ounces?|g|grams?|kg|kilograms?|lbs?|pounds?|ml|milliliters?|l|liters?|scoops?|slices?|pieces?|containers?|medium|large|small|servings?))$/i;

/** Default single servings for calorie-dense foods — never invent a 4 oz "serving". */
const DENSE_FOOD_DEFAULT_SERVING: Record<string, string> = {
  'peanut butter': '2 tbsp',
  'almond butter': '2 tbsp',
  'peanuts': '1 oz',
  'honey': '1 tbsp',
  'olive oil': '1 tbsp',
  'whey protein': '1 scoop',
};

function normalizeFood(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

function scaleMacros(base: FoodMacroEstimate, multiplier: number): FoodMacroEstimate {
  return {
    calories: Math.round(base.calories * multiplier),
    proteinG: Math.round(base.proteinG * multiplier * 10) / 10,
    carbsG: Math.round(base.carbsG * multiplier * 10) / 10,
    fatG: Math.round(base.fatG * multiplier * 10) / 10,
  };
}

function sumMacros(parts: FoodMacroEstimate[]): FoodMacroEstimate {
  return parts.reduce<FoodMacroEstimate>(
    (acc, part) => ({
      calories: acc.calories + part.calories,
      proteinG: Math.round((acc.proteinG + part.proteinG) * 10) / 10,
      carbsG: Math.round((acc.carbsG + part.carbsG) * 10) / 10,
      fatG: Math.round((acc.fatG + part.fatG) * 10) / 10,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

export function isGenericServingSize(servingSize: string): boolean {
  const normalized = servingSize.trim().toLowerCase();
  return (
    !normalized ||
    normalized === '1' ||
    normalized === '1x' ||
    normalized === 'x1' ||
    normalized === 'serving' ||
    normalized === '1 serving' ||
    normalized === '1 servings'
  );
}

/** Pull "2 tablespoons peanut butter" or "chicken breast 6 oz" into food + serving. */
export function extractEmbeddedServing(foodName: string): { food: string; serving: string } | null {
  const trimmed = foodName.trim();
  const leading = trimmed.match(EMBEDDED_SERVING_RE);
  if (leading) return { serving: leading[1].trim(), food: leading[2].trim() };
  const trailing = trimmed.match(TRAILING_SERVING_RE);
  if (trailing) return { food: trailing[1].trim(), serving: trailing[2].trim() };
  return null;
}

function splitOnConnectors(part: string): string[] {
  // Split "banana and peanut butter" / "PB + peanuts" without breaking "mac and cheese"-style
  // names that aren't in our catalog (acceptable — those fall through to generic).
  return part
    .split(/\s*(?:\+|\&|\band\b)\s*/i)
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Split composite titles like "yogurt, blueberries, 2 tbsp peanut butter". */
export function splitCompositeFoodParts(foodName: string): string[] {
  const normalized = foodName.trim();
  if (!normalized) return [];

  const byComma = normalized
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const parts = (byComma.length > 1 ? byComma : [normalized]).flatMap((part) => {
    const withParts = part
      .split(/\s+with\s+/i)
      .map((item) => item.trim())
      .filter(Boolean);
    const afterWith = withParts.length > 1 ? withParts : [part];
    return afterWith.flatMap((item) => {
      const connected = splitOnConnectors(item);
      return connected.length > 1 ? connected : [item];
    });
  });

  return parts.length > 1 ? parts : [normalized];
}

function lookupFoodKey(foodName: string): string | null {
  const key = normalizeFood(foodName);
  if (FOOD_PER_OZ[key]) return key;

  // Longest match first so "lean ground beef" wins over "ground beef".
  // Word boundaries keep "peanuts" from becoming peanut butter.
  const patterns = Object.keys(FOOD_PER_OZ).sort((a, b) => b.length - a.length);
  return (
    patterns.find((pattern) => new RegExp(`\\b${escapeRegExp(pattern)}\\b`, 'i').test(key)) ?? null
  );
}

function defaultServingForFood(foodKey: string | null): string {
  if (foodKey && DENSE_FOOD_DEFAULT_SERVING[foodKey]) return DENSE_FOOD_DEFAULT_SERVING[foodKey];
  if (foodKey === 'oikos' || foodKey === 'oikos triple zero' || foodKey === 'greek yogurt') {
    return '1 container';
  }
  if (foodKey === 'blueberries' || foodKey === 'berries') return '1/2 cup';
  if (foodKey === 'banana' || foodKey === 'apple' || foodKey === 'egg') return '1 medium';
  return '1 serving';
}

/** Ounces described by a serving string, using per-food unit weights where known. */
export function servingSizeInOunces(foodKey: string | null, servingSize: string): number | null {
  const amount = parseAmount(servingSize);
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return null;

  const unit = parseUnit(servingSize);
  if (!unit) {
    // Bare "1" / "2" without a unit: for dense foods use their real default, not 4 oz.
    if (foodKey && DENSE_FOOD_DEFAULT_SERVING[foodKey] && isGenericServingSize(servingSize)) {
      return servingSizeInOunces(foodKey, DENSE_FOOD_DEFAULT_SERVING[foodKey]);
    }
    if (foodKey && DENSE_FOOD_DEFAULT_SERVING[foodKey] && amount === 1) {
      return servingSizeInOunces(foodKey, DENSE_FOOD_DEFAULT_SERVING[foodKey]);
    }
    return amount * OZ_PER_UNIT.serving;
  }

  const perFood = foodKey ? FOOD_UNIT_OZ[foodKey]?.[unit] : undefined;
  return amount * (perFood ?? OZ_PER_UNIT[unit]);
}

function estimateSingleFood(foodName: string, servingSize: string): FoodMacroEstimate {
  const embedded = extractEmbeddedServing(foodName);
  const cleanName = embedded?.food ?? foodName;
  const key = lookupFoodKey(cleanName);

  let effectiveServing: string;
  if (embedded && isGenericServingSize(servingSize)) {
    effectiveServing = embedded.serving;
  } else if (!servingSize || isGenericServingSize(servingSize)) {
    effectiveServing = defaultServingForFood(key);
  } else {
    effectiveServing = servingSize;
  }

  const base = key ? FOOD_PER_OZ[key] : { calories: 50, proteinG: 5, carbsG: 3, fatG: 2 };
  const ounces = servingSizeInOunces(key, effectiveServing);
  return scaleMacros(base, ounces ?? servingSizeInOunces(key, defaultServingForFood(key)) ?? 1);
}

export function estimateFoodMacrosLocal(foodName: string, servingSize: string): FoodMacroEstimate {
  const parts = splitCompositeFoodParts(foodName);
  if (parts.length > 1) {
    return sumMacros(
      parts.map((part) => {
        const embedded = extractEmbeddedServing(part);
        if (embedded) return estimateSingleFood(part, embedded.serving);
        return estimateSingleFood(part, isGenericServingSize(servingSize) ? '1 serving' : servingSize);
      }),
    );
  }

  return estimateSingleFood(foodName, servingSize);
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
          'You are a nutrition estimator. Return JSON only: { calories, proteinG, carbsG, fatG, reasoning }. Estimate macros for the exact food and serving. If the foodName lists multiple items, sum them. Never treat a mixed snack as only peanut butter. Round calories to integer, macros to 1 decimal.',
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
  // Prefer local parsing for composites / embedded servings — OpenAI has over-attributed
  // calorie-dense toppings like peanut butter to the whole mixed snack.
  const parts = splitCompositeFoodParts(foodName);
  const hasEmbedded = Boolean(extractEmbeddedServing(foodName)) || parts.some((part) => extractEmbeddedServing(part));
  if (parts.length > 1 || hasEmbedded) {
    const local = estimateFoodMacrosLocal(foodName, servingSize);
    return {
      ...local,
      reasoning: `Parsed estimate for ${foodName} (${servingSize}). Review before saving.`,
    };
  }

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
