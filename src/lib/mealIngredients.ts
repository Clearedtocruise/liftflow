export type MealIngredient = {
  name: string;
  serving: string;
};

export type MealMeta = {
  status?: 'planned' | 'completed' | 'skipped' | 'modified';
  scheduledTime?: string;
  ingredients?: MealIngredient[];
};

export type MealMacros = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
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
  'apple with almond butter': { calories: 220, proteinG: 6, carbsG: 28, fatG: 12 },
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
  return MEAL_INGREDIENT_TEMPLATES[key] ?? [{ name, serving: '1 serving' }];
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
