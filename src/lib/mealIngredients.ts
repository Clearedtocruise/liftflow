export type MealIngredient = {
  name: string;
  serving: string;
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
};

const INGREDIENT_ALTERNATIVES: Record<string, string[]> = {
  'chicken breast': ['Turkey breast', 'Lean beef', 'White fish', 'Tofu'],
  'salmon fillet': ['Cod', 'Tilapia', 'Chicken breast', 'Tofu'],
  'greek yogurt': ['Skyr', 'Cottage cheese', 'Plant yogurt'],
  'white rice': ['Quinoa', 'Brown rice', 'Sweet potato'],
};

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

export function ingredientsForMealName(name: string): MealIngredient[] {
  const key = name.trim().toLowerCase();
  return MEAL_INGREDIENT_TEMPLATES[key] ?? [{ name: name, serving: '1 serving' }];
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
    return ['Protein shake and banana', 'Deli turkey sandwich', 'Greek yogurt and fruit'];
  }
  if (reason === 'restaurant') {
    return ['Grilled chicken restaurant bowl', 'Steak and side salad', 'Sushi or poke bowl'];
  }
  if (base.includes('chicken')) return ['Turkey rice bowl', 'Lean beef and potatoes', 'White fish and rice'];
  if (base.includes('salmon')) return ['Chicken and vegetables', 'Turkey bowl', 'Tofu stir fry'];
  return ['Turkey and rice bowl', 'Egg scramble plate', 'Lean beef bowl'];
}
