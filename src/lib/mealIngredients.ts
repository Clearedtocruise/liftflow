import {
  estimateFoodMacrosLocal,
  extractEmbeddedServing,
  splitCompositeFoodParts,
} from '@/lib/foodMacroLookup';

export type MealIngredient = {
  name: string;
  serving: string;
};

export type MealMacros = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type MealMeta = {
  status?: 'planned' | 'completed' | 'skipped' | 'modified';
  scheduledTime?: string;
  ingredients?: MealIngredient[];
};

const MEAL_INGREDIENT_TEMPLATES: Record<string, MealIngredient[]> = {
  'pre-workout banana and oats': [
    { name: 'Banana', serving: '1 medium' },
    { name: 'Rolled oats', serving: '1/2 cup' },
    { name: 'Honey', serving: '1 tbsp' },
  ],
  'greek yogurt bowl with berries': [
    { name: 'Greek yogurt', serving: '1 cup' },
    { name: 'Mixed berries', serving: '1/2 cup' },
    { name: 'Honey', serving: '1 tbsp' },
  ],
  'grilled chicken rice bowl': [
    { name: 'Chicken breast', serving: '6 oz' },
    { name: 'White rice', serving: '1 cup cooked' },
    { name: 'Broccoli', serving: '1 cup' },
  ],
  'salmon with roasted vegetables': [
    { name: 'Salmon fillet', serving: '6 oz' },
    { name: 'Mixed vegetables', serving: '2 cups' },
    { name: 'Olive oil', serving: '1 tbsp' },
  ],
  'protein shake with banana': [
    { name: 'Whey protein', serving: '1 scoop' },
    { name: 'Banana', serving: '1 medium' },
    { name: 'Almond milk', serving: '8 oz' },
  ],
  'apple with almond butter': [
    { name: 'Apple', serving: '1 medium' },
    { name: 'Almond butter', serving: '2 tbsp' },
  ],
  'oatmeal with banana and peanut butter': [
    { name: 'Oatmeal', serving: '1 serving' },
    { name: 'Banana', serving: '1 medium' },
    { name: 'Peanut butter', serving: '2 tbsp' },
  ],
  'rice cakes with peanut butter': [
    { name: 'Rice cakes', serving: '2 pieces' },
    { name: 'Peanut butter', serving: '2 tbsp' },
  ],
  'celery with peanut butter': [
    { name: 'Celery', serving: '2 stalks' },
    { name: 'Peanut butter', serving: '2 tbsp' },
  ],
  'celery with almond butter': [
    { name: 'Celery', serving: '2 stalks' },
    { name: 'Almond butter', serving: '2 tbsp' },
  ],
  'chia pudding with almond butter': [
    { name: 'Chia pudding', serving: '1 cup' },
    { name: 'Almond butter', serving: '1 tbsp' },
  ],
  'apple with peanut butter': [
    { name: 'Apple', serving: '1 medium' },
    { name: 'Peanut butter', serving: '2 tbsp' },
  ],
  'apple with rice cakes': [
    { name: 'Apple', serving: '1 medium' },
    { name: 'Rice cakes', serving: '2 pieces' },
  ],
  'egg white omelette with turkey': [
    { name: 'Egg whites', serving: '1 cup' },
    { name: 'Turkey breast', serving: '4 oz' },
    { name: 'Spinach', serving: '1 cup' },
  ],
  'grilled chicken and quinoa': [
    { name: 'Chicken breast', serving: '6 oz' },
    { name: 'Quinoa', serving: '1 cup cooked' },
    { name: 'Asparagus', serving: '1 cup' },
  ],
  'protein-forward greek bowl': [
    { name: 'Greek yogurt', serving: '1.5 cups' },
    { name: 'Whey protein', serving: '1 scoop' },
    { name: 'Berries', serving: '1/2 cup' },
  ],
  'large salad with grilled fish': [
    { name: 'Mixed greens', serving: '3 cups' },
    { name: 'White fish', serving: '5 oz' },
    { name: 'Olive oil', serving: '1 tbsp' },
  ],
  'zucchini noodle bowl': [
    { name: 'Zucchini noodles', serving: '2 cups' },
    { name: 'Turkey meatballs', serving: '4 oz' },
    { name: 'Marinara', serving: '1/2 cup' },
  ],
  'light turkey wrap': [
    { name: 'Turkey breast', serving: '4 oz' },
    { name: 'Whole wheat wrap', serving: '1 large' },
    { name: 'Lettuce', serving: '1 cup' },
  ],
  'deli turkey sandwich': [
    { name: 'Turkey breast', serving: '5 oz' },
    { name: 'Whole grain bread', serving: '2 slices' },
    { name: 'Mustard', serving: '1 tbsp' },
  ],
  'greek yogurt and fruit': [
    { name: 'Greek yogurt', serving: '1 cup' },
    { name: 'Banana', serving: '1 medium' },
    { name: 'Honey', serving: '1 tsp' },
  ],
  'grilled chicken restaurant bowl': [
    { name: 'Grilled chicken', serving: '6 oz' },
    { name: 'Rice', serving: '1 cup' },
    { name: 'Vegetables', serving: '1 cup' },
  ],
  'steak and side salad': [
    { name: 'Sirloin steak', serving: '6 oz' },
    { name: 'Mixed salad', serving: '2 cups' },
    { name: 'Balsamic', serving: '1 tbsp' },
  ],
  'sushi or poke bowl': [
    { name: 'Salmon', serving: '5 oz' },
    { name: 'Rice', serving: '3/4 cup' },
    { name: 'Edamame', serving: '1/2 cup' },
  ],
  'turkey rice bowl': [
    { name: 'Turkey breast', serving: '6 oz' },
    { name: 'White rice', serving: '1 cup cooked' },
    { name: 'Broccoli', serving: '1 cup' },
  ],
  'lean beef and potatoes': [
    { name: 'Lean beef', serving: '6 oz' },
    { name: 'Potatoes', serving: '1 medium' },
    { name: 'Green beans', serving: '1 cup' },
  ],
  'white fish and rice': [
    { name: 'Cod', serving: '6 oz' },
    { name: 'White rice', serving: '1 cup cooked' },
    { name: 'Lemon', serving: '1 wedge' },
  ],
  'chicken and vegetables': [
    { name: 'Chicken breast', serving: '6 oz' },
    { name: 'Mixed vegetables', serving: '2 cups' },
    { name: 'Olive oil', serving: '1 tbsp' },
  ],
  'turkey bowl': [
    { name: 'Turkey breast', serving: '6 oz' },
    { name: 'Quinoa', serving: '3/4 cup' },
    { name: 'Roasted vegetables', serving: '1 cup' },
  ],
  'tofu stir fry': [
    { name: 'Tofu', serving: '6 oz' },
    { name: 'Mixed vegetables', serving: '2 cups' },
    { name: 'Brown rice', serving: '3/4 cup' },
  ],
  'egg scramble plate': [
    { name: 'Eggs', serving: '3 large' },
    { name: 'Turkey sausage', serving: '2 oz' },
    { name: 'Spinach', serving: '1 cup' },
  ],
  'lean beef bowl': [
    { name: 'Lean beef', serving: '6 oz' },
    { name: 'Rice', serving: '3/4 cup' },
    { name: 'Peppers', serving: '1 cup' },
  ],
};

const MEAL_MACROS: Record<string, MealMacros> = {
  'pre-workout banana and oats': { calories: 280, proteinG: 12, carbsG: 48, fatG: 5 },
  'greek yogurt bowl with berries': { calories: 450, proteinG: 35, carbsG: 45, fatG: 12 },
  'grilled chicken rice bowl': { calories: 650, proteinG: 50, carbsG: 60, fatG: 14 },
  'salmon with roasted vegetables': { calories: 700, proteinG: 45, carbsG: 30, fatG: 38 },
  'protein shake with banana': { calories: 300, proteinG: 30, carbsG: 30, fatG: 5 },
  'apple with almond butter': { calories: 295, proteinG: 7, carbsG: 28, fatG: 16 },
  'oatmeal with banana and peanut butter': { calories: 420, proteinG: 18, carbsG: 55, fatG: 14 },
  'rice cakes with peanut butter': { calories: 230, proteinG: 10, carbsG: 26, fatG: 10 },
  'celery with peanut butter': { calories: 200, proteinG: 8, carbsG: 10, fatG: 14 },
  'celery with almond butter': { calories: 210, proteinG: 6, carbsG: 8, fatG: 16 },
  'chia pudding with almond butter': { calories: 370, proteinG: 16, carbsG: 18, fatG: 24 },
  'apple with peanut butter': { calories: 295, proteinG: 7, carbsG: 28, fatG: 16 },
  'apple with rice cakes': { calories: 230, proteinG: 4, carbsG: 48, fatG: 2 },
  'egg white omelette with turkey': { calories: 320, proteinG: 42, carbsG: 8, fatG: 8 },
  'grilled chicken and quinoa': { calories: 580, proteinG: 48, carbsG: 52, fatG: 12 },
  'protein-forward greek bowl': { calories: 420, proteinG: 45, carbsG: 35, fatG: 8 },
  'large salad with grilled fish': { calories: 380, proteinG: 38, carbsG: 18, fatG: 16 },
  'zucchini noodle bowl': { calories: 420, proteinG: 32, carbsG: 28, fatG: 14 },
  'light turkey wrap': { calories: 390, proteinG: 34, carbsG: 36, fatG: 10 },
  'deli turkey sandwich': { calories: 440, proteinG: 36, carbsG: 42, fatG: 12 },
  'greek yogurt and fruit': { calories: 280, proteinG: 22, carbsG: 38, fatG: 4 },
  'grilled chicken restaurant bowl': { calories: 620, proteinG: 46, carbsG: 58, fatG: 16 },
  'steak and side salad': { calories: 540, proteinG: 42, carbsG: 12, fatG: 32 },
  'sushi or poke bowl': { calories: 580, proteinG: 38, carbsG: 62, fatG: 14 },
  'turkey rice bowl': { calories: 600, proteinG: 46, carbsG: 58, fatG: 12 },
  'lean beef and potatoes': { calories: 640, proteinG: 44, carbsG: 48, fatG: 24 },
  'white fish and rice': { calories: 520, proteinG: 40, carbsG: 56, fatG: 8 },
  'chicken and vegetables': { calories: 480, proteinG: 42, carbsG: 22, fatG: 18 },
  'turkey bowl': { calories: 560, proteinG: 44, carbsG: 48, fatG: 14 },
  'tofu stir fry': { calories: 490, proteinG: 28, carbsG: 52, fatG: 16 },
  'egg scramble plate': { calories: 420, proteinG: 32, carbsG: 8, fatG: 28 },
  'lean beef bowl': { calories: 610, proteinG: 42, carbsG: 50, fatG: 22 },
};

const INGREDIENT_ALTERNATIVES: Record<string, string[]> = {
  'chicken breast': ['Turkey breast', 'Lean beef', 'White fish', 'Tofu'],
  'grilled chicken': ['Turkey breast', 'Salmon', 'Tofu'],
  'salmon fillet': ['Cod', 'Tilapia', 'Chicken breast', 'Tofu'],
  'salmon': ['Cod', 'Tilapia', 'Chicken breast'],
  'greek yogurt': ['Skyr', 'Cottage cheese', 'Plant yogurt'],
  'white rice': ['Quinoa', 'Brown rice', 'Sweet potato'],
  'mixed berries': ['Banana slices', 'Apple slices', 'Peach slices'],
};

export type MealReplacementReason =
  | 'default'
  | 'faster'
  | 'restaurant'
  | 'higher_protein'
  | 'lower_calorie';

export function parseMealMeta(instructions?: string): MealMeta {
  if (!instructions) return {};
  if (instructions === 'supplement') return {};
  try {
    const parsed = JSON.parse(instructions) as MealMeta;
    return parsed ?? {};
  } catch {
    return {};
  }
}

export function serializeMealMeta(meta: MealMeta): string {
  return JSON.stringify(meta);
}

function mealKey(name: string): string {
  return name.trim().toLowerCase();
}

export function ingredientsForMealName(name: string): MealIngredient[] {
  const key = mealKey(name);
  if (MEAL_INGREDIENT_TEMPLATES[key]) return MEAL_INGREDIENT_TEMPLATES[key];

  // Prefer splitting free-text snack titles over estimating the whole string as one food.
  const parts = splitCompositeFoodParts(name);
  if (parts.length > 1) {
    return parts.map((part) => {
      const embedded = extractEmbeddedServing(part);
      if (embedded) return { name: embedded.food, serving: embedded.serving };
      return { name: part, serving: '1 serving' };
    });
  }

  const embedded = extractEmbeddedServing(name);
  if (embedded) return [{ name: embedded.food, serving: embedded.serving }];

  return [{ name, serving: '1 serving' }];
}


export function macrosForMealName(name: string): MealMacros {
  const key = mealKey(name);
  return MEAL_MACROS[key] ?? { calories: 400, proteinG: 30, carbsG: 35, fatG: 12 };
}

export function enrichMealMeta(name: string, instructions?: string): MealMeta {
  const existing = parseMealMeta(instructions);
  return {
    status: existing.status ?? 'planned',
    scheduledTime: existing.scheduledTime,
    ingredients: existing.ingredients?.length ? existing.ingredients : ingredientsForMealName(name),
  };
}

function titleCaseToken(token: string): string {
  if (!token) return token;
  return token.charAt(0).toUpperCase() + token.slice(1);
}

function humanizeMealName(input: string): string {
  return input
    .trim()
    .split(/\s+/)
    .map((token) => {
      if (/^(and|with|or|of|a|an|the)$/i.test(token)) return token.toLowerCase();
      return token
        .split('-')
        .map((part) => titleCaseToken(part.toLowerCase()))
        .join('-');
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function mealNameFromIngredients(ingredients: MealIngredient[]): string | null {
  const names = ingredients
    .map((ingredient) => ingredient.name.trim())
    .filter(Boolean);

  if (names.length === 0) return null;
  if (names.length === 1) return humanizeMealName(names[0]!);
  if (names.length === 2) return `${humanizeMealName(names[0]!)} with ${humanizeMealName(names[1]!)}`;

  const primary = humanizeMealName(names[0]!);
  const extras = names
    .slice(1, 3)
    .map((name) => humanizeMealName(name));
  return `${primary} with ${extras.join(' and ')}`;
}

type MealMacroFields = {
  name: string;
  instructions?: string;
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  /** Set when the stored macros are a real measurement, so 0 means zero rather than unknown. */
  macrosProvided?: boolean;
};

const CARB_SHARE_OF_REMAINING_KCAL = 0.55;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function macrosFromIngredients(meal: MealMacroFields): MealMacros | null {
  const ingredients = enrichMealMeta(meal.name, meal.instructions).ingredients ?? [];
  if (ingredients.length === 0) return null;

  return ingredients.reduce<MealMacros>(
    (acc, ingredient) => {
      const estimate = estimateFoodMacrosLocal(ingredient.name, ingredient.serving);
      return {
        calories: acc.calories + estimate.calories,
        proteinG: round1(acc.proteinG + estimate.proteinG),
        carbsG: round1(acc.carbsG + estimate.carbsG),
        fatG: round1(acc.fatG + estimate.fatG),
      };
    },
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

/**
 * Detect the peanut-butter-as-whole-meal bug: stored calories much higher than a
 * sane ingredient estimate, usually with extreme fat density on a mixed snack.
 */
export function looksLikeInflatedMealMacros(
  meal: MealMacroFields,
  estimated: MealMacros | null,
): boolean {
  const storedCal = meal.calories ?? 0;
  if (storedCal < 450 || !estimated || estimated.calories <= 0) return false;

  if (storedCal >= estimated.calories * 1.45 && estimated.calories >= 150) return true;

  const fatKcalShare = ((meal.fatG ?? 0) * 9) / storedCal;
  const mixed =
    /,|\bwith\b|\band\b|\+/.test(meal.name) ||
    (enrichMealMeta(meal.name, meal.instructions).ingredients?.length ?? 0) > 1;
  const denseName = /peanut butter|almond butter|olive oil|peanuts/i.test(meal.name);
  return mixed && denseName && fatKcalShare >= 0.55 && storedCal > estimated.calories * 1.25;
}

/**
 * Fill in macros the user never entered by distributing the calories that
 * protein/carbs/fat do not already account for. A quick log of "600 kcal, 40 g
 * protein" otherwise reports zero carbs and zero fat.
 */
function distributeRemainingCalories(meal: MealMacroFields): MealMacros {
  const calories = meal.calories ?? 0;
  const proteinG = meal.proteinG ?? 0;
  const carbsMissing = meal.carbsG == null;
  const fatMissing = meal.fatG == null;
  const carbsG = meal.carbsG ?? 0;
  const fatG = meal.fatG ?? 0;

  const remaining = calories - proteinG * 4 - carbsG * 4 - fatG * 9;
  if (remaining <= 0 || (!carbsMissing && !fatMissing)) {
    return { calories, proteinG, carbsG, fatG };
  }

  if (carbsMissing && fatMissing) {
    return {
      calories,
      proteinG,
      carbsG: round1((remaining * CARB_SHARE_OF_REMAINING_KCAL) / 4),
      fatG: round1((remaining * (1 - CARB_SHARE_OF_REMAINING_KCAL)) / 9),
    };
  }

  return {
    calories,
    proteinG,
    carbsG: carbsMissing ? round1(remaining / 4) : carbsG,
    fatG: fatMissing ? round1(remaining / 9) : fatG,
  };
}

/**
 * Stored macros when they were actually measured; otherwise estimate from the
 * logged ingredients. Inflated legacy estimates (composite snacks priced as
 * peanut butter) are replaced with the ingredient-based estimate.
 */
export function resolveMealMacros(meal: MealMacroFields): MealMacros {
  const estimated = macrosFromIngredients(meal);
  const hasAnyStoredValue =
    meal.calories != null || meal.proteinG != null || meal.carbsG != null || meal.fatG != null;
  const measured = meal.macrosProvided ?? hasAnyStoredValue;

  if (measured && looksLikeInflatedMealMacros(meal, estimated) && estimated) {
    return estimated;
  }

  if (measured) return distributeRemainingCalories(meal);

  return estimated ?? { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
}

export function resolveMealMacrosFromIngredients(
  name: string,
  instructions?: string,
): MealMacros {
  return resolveMealMacros({
    name,
    instructions,
    macrosProvided: false,
  });
}

export function alternativesForIngredient(ingredientName: string): string[] {
  const key = ingredientName.trim().toLowerCase();
  return INGREDIENT_ALTERNATIVES[key] ?? ['Similar protein', 'Similar carb', 'Similar fat source'];
}

export function mealAlternatives(mealName: string, reason: string): string[] {
  const base = mealName.toLowerCase();
  if (reason === 'higher_protein') {
    return ['Egg white omelette with turkey', 'Grilled chicken and quinoa', 'Protein-forward Greek bowl'];
  }
  if (reason === 'lower_calorie') {
    return ['Large salad with grilled fish', 'Zucchini noodle bowl', 'Light turkey wrap'];
  }
  if (reason === 'faster') {
    return ['Protein shake with banana', 'Deli turkey sandwich', 'Greek yogurt and fruit'];
  }
  if (reason === 'restaurant') {
    return ['Grilled chicken restaurant bowl', 'Steak and side salad', 'Sushi or poke bowl'];
  }
  if (base.includes('chicken')) return ['Turkey rice bowl', 'Lean beef and potatoes', 'White fish and rice'];
  if (base.includes('salmon')) return ['Chicken and vegetables', 'Turkey bowl', 'Tofu stir fry'];
  return ['Turkey rice bowl', 'Egg scramble plate', 'Lean beef bowl'];
}

export function buildLocalMealAlternatives(
  mealName: string,
  reason: MealReplacementReason,
): Array<MealMacros & { name: string; ingredients: MealIngredient[] }> {
  return mealAlternatives(mealName, reason).map((name) => ({
    name,
    ...macrosForMealName(name),
    ingredients: ingredientsForMealName(name),
  }));
}
