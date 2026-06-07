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
