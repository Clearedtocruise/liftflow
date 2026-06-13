import type { FoodMacroEstimate } from '@/types/nutrition';

/** Client-side fallback when API unavailable — mirrors backend heuristics. */
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

function scaleMacros(base: FoodMacroEstimate, multiplier: number): FoodMacroEstimate {
  return {
    calories: Math.round(base.calories * multiplier),
    proteinG: Math.round(base.proteinG * multiplier * 10) / 10,
    carbsG: Math.round(base.carbsG * multiplier * 10) / 10,
    fatG: Math.round(base.fatG * multiplier * 10) / 10,
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
  if (oz != null) return scaleMacros(base, oz);
  return scaleMacros(base, 6);
}
