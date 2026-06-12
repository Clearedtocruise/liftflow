import { getOpenAI, hasOpenAI } from './openai.js';

export type AdvisoryNutritionKind =
  | 'improve_meal_plan'
  | 'improve_grocery_list'
  | 'fuel_todays_workout';

export type AdvisoryWorkoutKind =
  | 'improve_plan'
  | 'explain_today'
  | 'suggest_substitutions';

type NutritionContext = Record<string, unknown>;
type WorkoutContext = Record<string, unknown>;

export type NutritionAdvisoryResponse = {
  reasoning: string;
  mealPlan: Array<{ label: string; items: string[] }>;
  groceryImprovements: string[];
  preWorkoutMealTiming: string;
  postWorkoutMealTiming: string;
};

export type WorkoutAdvisoryResponse = {
  reasoning: string;
  workoutName: string;
  exercises: Array<{ exerciseName: string; sets: number; reps: number; weightLb: number }>;
  substitutions?: Array<{ from: string; to: string; reason: string }>;
};

export type ExplainWorkoutAdvisoryResponse = {
  reasoning: string;
  summary: string;
  focusPoints: string[];
};

function fallbackNutritionAdvisory(
  kind: AdvisoryNutritionKind,
  context: NutritionContext,
): NutritionAdvisoryResponse {
  const currentMealPlan = Array.isArray(context.currentMealPlan)
    ? (context.currentMealPlan as Array<{ label: string; items: string[] }>)
    : [];
  const workoutName =
    context.todaysWorkout && typeof context.todaysWorkout === 'object'
      ? String((context.todaysWorkout as { workoutName?: string }).workoutName ?? 'Training')
      : 'Training';

  const mealPlan =
    currentMealPlan.length > 0
      ? currentMealPlan.map((meal) => ({
          label: meal.label,
          items: [...meal.items, kind === 'improve_grocery_list' ? 'Meal prep containers' : 'Water'],
        }))
      : [
          { label: 'Breakfast', items: ['Eggs', 'Oatmeal', 'Fruit'] },
          { label: 'Lunch', items: ['Chicken', 'Rice', 'Vegetables'] },
          { label: 'Dinner', items: ['Lean protein', 'Potatoes', 'Vegetables'] },
          { label: 'Snack', items: ['Greek Yogurt', 'Protein Shake'] },
        ];

  return {
    reasoning:
      kind === 'fuel_todays_workout'
        ? `Prioritize protein and carbs around ${workoutName}. This is a rule-based fallback while OpenAI is unavailable.`
        : 'Rule-based nutrition advisory fallback. Review suggestions before applying.',
    mealPlan,
    groceryImprovements: ['Avocados', 'Olive Oil', 'Spinach', 'Bananas'],
    preWorkoutMealTiming: 'Eat a light carb + protein meal 60–90 minutes before training.',
    postWorkoutMealTiming: 'Have protein and carbs within 60 minutes after training.',
  };
}

function fallbackWorkoutAdvisory(
  kind: AdvisoryWorkoutKind,
  context: WorkoutContext,
): WorkoutAdvisoryResponse {
  const todays =
    context.todaysWorkout && typeof context.todaysWorkout === 'object'
      ? (context.todaysWorkout as WorkoutAdvisoryResponse)
      : null;
  const generated =
    context.generatedPlan && typeof context.generatedPlan === 'object'
      ? (context.generatedPlan as WorkoutAdvisoryResponse)
      : null;
  const base = todays ?? generated ?? {
    workoutName: 'Full Body',
    exercises: [
      { exerciseName: 'Goblet Squat', sets: 3, reps: 10, weightLb: 50 },
      { exerciseName: 'Dumbbell Bench Press', sets: 3, reps: 10, weightLb: 50 },
      { exerciseName: 'Dumbbell Row', sets: 3, reps: 10, weightLb: 50 },
    ],
  };

  const substitutions =
    kind === 'suggest_substitutions'
      ? base.exercises.slice(0, 2).map((exercise) => ({
          from: exercise.exerciseName,
          to: `${exercise.exerciseName} (machine or dumbbell variant)`,
          reason: 'Equipment-friendly alternative with similar movement pattern.',
        }))
      : undefined;

  return {
    reasoning:
      kind === 'improve_plan'
        ? 'Rule-based workout advisory fallback. Adds one accessory set pattern while keeping your main lifts.'
        : 'Rule-based substitution suggestions. Review before applying.',
    workoutName: base.workoutName,
    exercises: base.exercises.map((exercise) => ({
      ...exercise,
      sets: Math.min(5, exercise.sets + (kind === 'improve_plan' ? 1 : 0)),
    })),
    substitutions,
  };
}

function fallbackExplainWorkout(context: WorkoutContext): ExplainWorkoutAdvisoryResponse {
  const todays =
    context.todaysWorkout && typeof context.todaysWorkout === 'object'
      ? (context.todaysWorkout as { workoutName?: string; sessionType?: string })
      : null;
  const workoutName = todays?.workoutName ?? 'your next session';
  const sessionType = todays?.sessionType ?? 'training';

  return {
    reasoning: 'Rule-based explanation fallback while OpenAI is unavailable.',
    summary: `${workoutName} focuses on ${sessionType} patterns with progressive effort on your primary lifts.`,
    focusPoints: [
      'Warm up with lighter sets before working weights.',
      'Keep rest intentional between compound sets.',
      'Stop sets with 1–2 reps in reserve on accessories.',
    ],
  };
}

async function callOpenAiJson<T>(system: string, user: string): Promise<T | null> {
  const openai = getOpenAI();
  if (!openai || !hasOpenAI()) return null;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.4,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) return null;
  return JSON.parse(content) as T;
}

export async function generateNutritionAdvisory(
  kind: AdvisoryNutritionKind,
  context: NutritionContext,
): Promise<NutritionAdvisoryResponse> {
  const prompt = JSON.stringify({ kind, context });
  const ai = await callOpenAiJson<NutritionAdvisoryResponse>(
    `You are an advisory fitness nutrition coach. Return JSON only with keys:
reasoning, mealPlan[{label,items[]}], groceryImprovements[], preWorkoutMealTiming, postWorkoutMealTiming.
Respect allergies and diet preference. Do not exceed user's macro targets dramatically.
This is advisory only — no medical claims.`,
    prompt,
  );

  if (
    ai?.reasoning &&
    Array.isArray(ai.mealPlan) &&
    ai.mealPlan.length > 0 &&
    Array.isArray(ai.groceryImprovements)
  ) {
    return ai;
  }

  return fallbackNutritionAdvisory(kind, context);
}

export async function generateWorkoutAdvisory(
  kind: AdvisoryWorkoutKind,
  context: WorkoutContext,
): Promise<WorkoutAdvisoryResponse> {
  const prompt = JSON.stringify({ kind, context });
  const ai = await callOpenAiJson<WorkoutAdvisoryResponse>(
    `You are an advisory strength coach. Return JSON only with keys:
reasoning, workoutName, exercises[{exerciseName,sets,reps,weightLb}], substitutions[{from,to,reason}] (optional).
Only suggest exercises compatible with listed equipment. Sets 1-8, reps 1-20, weightLb 0-500.
This is advisory only.`,
    prompt,
  );

  if (ai?.reasoning && ai.workoutName && Array.isArray(ai.exercises) && ai.exercises.length > 0) {
    return ai;
  }

  return fallbackWorkoutAdvisory(kind, context);
}

export async function generateExplainWorkoutAdvisory(
  context: WorkoutContext,
): Promise<ExplainWorkoutAdvisoryResponse> {
  const prompt = JSON.stringify({ context });
  const ai = await callOpenAiJson<ExplainWorkoutAdvisoryResponse>(
    `You are an advisory strength coach. Return JSON only with keys:
reasoning, summary, focusPoints[].
Explain today's workout clearly for a lifter. No auto-prescription of unsafe loads.`,
    prompt,
  );

  if (ai?.reasoning && ai.summary && Array.isArray(ai.focusPoints) && ai.focusPoints.length > 0) {
    return ai;
  }

  return fallbackExplainWorkout(context);
}

export type MealReplacementReason =
  | 'default'
  | 'faster'
  | 'restaurant'
  | 'higher_protein'
  | 'lower_calorie';

export type MealAlternativeOption = {
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  ingredients: Array<{ name: string; serving: string }>;
};

export type MealAlternativesResponse = {
  reasoning: string;
  alternatives: MealAlternativeOption[];
  ingredientAlternatives: Array<{ from: string; to: string; reason: string }>;
};

function fallbackMealAlternatives(context: {
  mealName: string;
  reason: MealReplacementReason;
  ingredients?: Array<{ name: string; serving: string }>;
}): MealAlternativesResponse {
  const reason = context.reason ?? 'default';
  const pools: Record<MealReplacementReason, MealAlternativeOption[]> = {
    default: [
      { name: 'Turkey rice bowl', calories: 600, proteinG: 46, carbsG: 58, fatG: 12, ingredients: [{ name: 'Turkey breast', serving: '6 oz' }, { name: 'White rice', serving: '1 cup cooked' }] },
      { name: 'Grilled chicken and quinoa', calories: 580, proteinG: 48, carbsG: 52, fatG: 12, ingredients: [{ name: 'Chicken breast', serving: '6 oz' }, { name: 'Quinoa', serving: '1 cup cooked' }] },
    ],
    higher_protein: [
      { name: 'Egg white omelette with turkey', calories: 320, proteinG: 42, carbsG: 8, fatG: 8, ingredients: [{ name: 'Egg whites', serving: '1 cup' }, { name: 'Turkey breast', serving: '4 oz' }] },
      { name: 'Protein-forward Greek bowl', calories: 420, proteinG: 45, carbsG: 35, fatG: 8, ingredients: [{ name: 'Greek yogurt', serving: '1.5 cups' }, { name: 'Whey protein', serving: '1 scoop' }] },
    ],
    lower_calorie: [
      { name: 'Large salad with grilled fish', calories: 380, proteinG: 38, carbsG: 18, fatG: 16, ingredients: [{ name: 'Mixed greens', serving: '3 cups' }, { name: 'White fish', serving: '5 oz' }] },
      { name: 'Zucchini noodle bowl', calories: 420, proteinG: 32, carbsG: 28, fatG: 14, ingredients: [{ name: 'Zucchini noodles', serving: '2 cups' }, { name: 'Turkey meatballs', serving: '4 oz' }] },
    ],
    faster: [
      { name: 'Protein shake with banana', calories: 300, proteinG: 30, carbsG: 30, fatG: 5, ingredients: [{ name: 'Whey protein', serving: '1 scoop' }, { name: 'Banana', serving: '1 medium' }] },
      { name: 'Deli turkey sandwich', calories: 440, proteinG: 36, carbsG: 42, fatG: 12, ingredients: [{ name: 'Turkey breast', serving: '5 oz' }, { name: 'Whole grain bread', serving: '2 slices' }] },
    ],
    restaurant: [
      { name: 'Grilled chicken restaurant bowl', calories: 620, proteinG: 46, carbsG: 58, fatG: 16, ingredients: [{ name: 'Grilled chicken', serving: '6 oz' }, { name: 'Rice', serving: '1 cup' }] },
      { name: 'Sushi or poke bowl', calories: 580, proteinG: 38, carbsG: 62, fatG: 14, ingredients: [{ name: 'Salmon', serving: '5 oz' }, { name: 'Rice', serving: '3/4 cup' }] },
    ],
  };

  const ingredientAlternatives = (context.ingredients ?? []).slice(0, 4).map((item) => ({
    from: item.name,
    to: item.name.toLowerCase().includes('chicken') ? 'Turkey breast' : 'Similar swap',
    reason: 'Equipment- and preference-friendly substitute.',
  }));

  return {
    reasoning: `Rule-based alternatives for "${context.mealName}" (${reason}). Review before applying.`,
    alternatives: pools[reason] ?? pools.default,
    ingredientAlternatives,
  };
}

export async function generateMealAlternatives(context: {
  mealName: string;
  reason: MealReplacementReason;
  mealType?: string;
  ingredients?: Array<{ name: string; serving: string }>;
  dietaryRestrictions?: string[];
}): Promise<MealAlternativesResponse> {
  const prompt = JSON.stringify(context);
  const ai = await callOpenAiJson<MealAlternativesResponse>(
    `You are an advisory nutrition coach. Return JSON only with keys:
reasoning, alternatives[{name,calories,proteinG,carbsG,fatG,ingredients[{name,serving}]}], ingredientAlternatives[{from,to,reason}].
Suggest 3 meal swaps for the requested reason. Respect dietaryRestrictions. Keep calories within ~25% of a typical meal slot.
This is advisory only — no medical claims.`,
    prompt,
  );

  if (ai?.reasoning && Array.isArray(ai.alternatives) && ai.alternatives.length > 0) {
    return {
      reasoning: ai.reasoning,
      alternatives: ai.alternatives,
      ingredientAlternatives: Array.isArray(ai.ingredientAlternatives) ? ai.ingredientAlternatives : [],
    };
  }

  return fallbackMealAlternatives(context);
}
