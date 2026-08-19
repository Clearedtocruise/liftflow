import { asPromptData, chatCompletionText } from '../openai.js';
import type {
  ParsedMeal,
  ParsedNutritionDay,
  ParsedPersonalPlan,
  ParsedWorkoutDay,
  ParsedWorkoutExercise,
  UploadedPlanKind,
} from './uploadedPlanTypes.js';

const SYSTEM = `You extract a structured weekly training or nutrition plan from a PDF transcript.
Return JSON only. Never invent exercises or meals that are not in the document.
If the document is a workout plan, fill workouts (Monday = dayIndex 0).
If it is a meal plan, fill meals and nutritionGoals.
sets must be a positive integer. reps is a string like "8" or "8-10" or "60 sec".
mealType must be one of breakfast, lunch, dinner, snack, pre_workout, post_workout.`;

const MEAL_TYPES: ParsedMeal['mealType'][] = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'pre_workout',
  'post_workout',
];

function safeJson(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function asPositiveInt(value: unknown): number | undefined {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

function asDayIndex(value: unknown): number | undefined {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 6 ? Math.round(n) : undefined;
}

function asTrimmed(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeExercise(raw: unknown): ParsedWorkoutExercise | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const name = asTrimmed(row.name);
  const sets = asPositiveInt(row.sets);
  if (!name || sets == null) return null;
  return {
    name,
    sets,
    reps: asTrimmed(row.reps) ?? '8-10',
    restSeconds: asPositiveInt(row.restSeconds),
    notes: asTrimmed(row.notes),
  };
}

function normalizeWorkoutDay(raw: unknown): ParsedWorkoutDay | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const dayIndex = asDayIndex(row.dayIndex);
  const exercises = Array.isArray(row.exercises)
    ? row.exercises.map(normalizeExercise).filter((item): item is ParsedWorkoutExercise => item != null)
    : [];
  if (dayIndex == null || exercises.length === 0) return null;
  const muscleGroups = Array.isArray(row.muscleGroups)
    ? row.muscleGroups.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  return {
    dayIndex,
    label: asTrimmed(row.label) ?? `Day ${dayIndex + 1}`,
    muscleGroups,
    exercises,
  };
}

function normalizeMeal(raw: unknown): ParsedMeal | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const name = asTrimmed(row.name);
  const mealTypeRaw = asTrimmed(row.mealType)?.toLowerCase().replace(/[\s-]+/g, '_');
  const mealType = MEAL_TYPES.find((item) => item === mealTypeRaw);
  if (!name || !mealType) return null;
  return {
    mealType,
    name,
    scheduledTime: asTrimmed(row.scheduledTime),
    calories: asPositiveInt(row.calories),
    proteinG: asPositiveInt(row.proteinG),
    carbsG: asPositiveInt(row.carbsG),
    fatG: asPositiveInt(row.fatG),
    notes: asTrimmed(row.notes),
  };
}

function normalizeNutritionDay(raw: unknown): ParsedNutritionDay | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const dayIndex = asDayIndex(row.dayIndex);
  const meals = Array.isArray(row.meals)
    ? row.meals.map(normalizeMeal).filter((item): item is ParsedMeal => item != null)
    : [];
  if (dayIndex == null || meals.length === 0) return null;
  return { dayIndex, meals };
}

export function normalizeParsedPersonalPlan(
  kind: UploadedPlanKind,
  filename: string,
  raw: Record<string, unknown>,
): ParsedPersonalPlan | null {
  const title =
    asTrimmed(raw.title) ||
    filename.replace(/\.pdf$/i, '').trim() ||
    (kind === 'workout' ? 'Uploaded workout plan' : 'Uploaded nutrition plan');
  const workouts = Array.isArray(raw.workouts)
    ? raw.workouts.map(normalizeWorkoutDay).filter((item): item is ParsedWorkoutDay => item != null)
    : undefined;
  const meals = Array.isArray(raw.meals)
    ? raw.meals.map(normalizeNutritionDay).filter((item): item is ParsedNutritionDay => item != null)
    : undefined;
  const goalsRaw = raw.nutritionGoals && typeof raw.nutritionGoals === 'object' ? (raw.nutritionGoals as Record<string, unknown>) : null;
  const nutritionGoals = goalsRaw
    ? {
        calories: asPositiveInt(goalsRaw.calories),
        proteinG: asPositiveInt(goalsRaw.proteinG),
        carbsG: asPositiveInt(goalsRaw.carbsG),
        fatG: asPositiveInt(goalsRaw.fatG),
      }
    : undefined;

  const plan: ParsedPersonalPlan = {
    title,
    kind,
    workouts: workouts?.length ? workouts : undefined,
    meals: meals?.length ? meals : undefined,
    nutritionGoals:
      nutritionGoals &&
      (nutritionGoals.calories != null ||
        nutritionGoals.proteinG != null ||
        nutritionGoals.carbsG != null ||
        nutritionGoals.fatG != null)
        ? nutritionGoals
        : undefined,
  };

  if (kind === 'workout' && !plan.workouts?.length) return null;
  if (kind === 'nutrition' && !plan.meals?.length && !plan.nutritionGoals) return null;
  return plan;
}

export async function parseUploadedPlanText(
  kind: UploadedPlanKind,
  filename: string,
  text: string,
): Promise<ParsedPersonalPlan | null> {
  const excerpt = text.slice(0, 24_000);
  const result = await chatCompletionText({
    system: SYSTEM,
    user: [
      `kind=${kind}`,
      `filename=${filename}`,
      asPromptData('PDF_TEXT', excerpt),
      'Return JSON: { "title": string, "kind": "workout"|"nutrition", "workouts": [{ "dayIndex": 0-6, "label": string, "muscleGroups": string[], "exercises": [{ "name": string, "sets": number, "reps": string, "restSeconds"?: number, "notes"?: string }] }], "meals": [{ "dayIndex": 0-6, "meals": [{ "mealType": string, "name": string, "scheduledTime"?: string, "calories"?: number, "proteinG"?: number, "carbsG"?: number, "fatG"?: number }] }], "nutritionGoals": { "calories"?: number, "proteinG"?: number, "carbsG"?: number, "fatG"?: number } }',
    ].join('\n'),
    json: true,
    maxTokens: 2500,
    temperature: 0,
  });
  if (!result?.content) return null;
  const parsed = safeJson(result.content);
  if (!parsed) return null;
  return normalizeParsedPersonalPlan(kind, filename, parsed);
}
