import { parseMealStatus } from './nutritionPreferenceEngine.js';
import { requireAdmin } from './supabase.js';
import { resolveRankedGoals, toNutritionGoal } from './trainingGoals.js';
import {
  calculateMacroTargets,
  generateDailyMeals,
  inferWorkoutType,
  type MacroTargets,
  type NutritionContext,
} from './workoutAwareNutrition.js';

export type DayNutritionSync = {
  date: string;
  macros: MacroTargets;
  mealTiming: string[];
  hydrationNote: string;
  isTrainingDay: boolean;
  workoutName?: string;
  mealsUpdated: number;
  mealsInserted: number;
  mealsRemoved: number;
};

type PlannedWorkoutRow = {
  id: string;
  name: string;
  scheduled_date: string;
  status: string;
  suggested_muscle_groups?: string[] | null;
  metadata?: { sessionKind?: string } | null;
};

type MealRow = {
  id: string;
  meal_type: string;
  name: string;
  scheduled_date: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  instructions: string | null;
  meal_plan_id: string | null;
};

const PRE_WORKOUT = { mealType: 'pre_workout', name: 'Pre-workout banana and oats' };
const POST_WORKOUT = { mealType: 'post_workout', name: 'Protein shake with banana' };

function hydrationNote(bodyWeightKg: number, isTrainingDay: boolean): string {
  const ml = Math.round(bodyWeightKg * (isTrainingDay ? 35 : 30));
  return isTrainingDay
    ? `Training day — aim for ~${ml}ml water including pre- and post-workout.`
    : `Recovery day — aim for ~${ml}ml water.`;
}

function mealTimingLabels(isTrainingDay: boolean, count: number): string[] {
  if (isTrainingDay && count >= 4) {
    return ['7:15 AM', '10:30 AM', '12:00 PM', '3:00 PM', '6:00 PM', '7:30 PM'].slice(0, count);
  }
  const rest = ['7:15 AM', '12:00 PM', '3:30 PM', '7:00 PM'];
  return rest.slice(0, count);
}

function trainingDayMeals(date: string, macros: MacroTargets, style: NutritionContext['dietaryStyle']) {
  const base = generateDailyMeals(date, macros, style);
  const split = {
    pre_workout: 0.12,
    post_workout: 0.13,
    breakfast: 0.22,
    lunch: 0.28,
    snack: 0.08,
    dinner: 0.17,
  } as const;

  const templates = base.reduce(
    (acc, meal) => {
      acc[meal.mealType as keyof typeof split] = meal;
      return acc;
    },
    {} as Record<string, (typeof base)[number]>,
  );

  return (['pre_workout', 'post_workout', 'breakfast', 'lunch', 'snack', 'dinner'] as const).map((mealType) => {
    const ratio = split[mealType];
    const fallback = templates.breakfast ?? base[0];
    const name =
      mealType === 'pre_workout'
        ? PRE_WORKOUT.name
        : mealType === 'post_workout'
          ? POST_WORKOUT.name
          : (templates[mealType]?.name ?? fallback.name);
    return {
      mealType,
      name,
      scheduledDate: date,
      calories: Math.round(macros.calories * ratio),
      proteinG: Math.round(macros.proteinG * ratio),
      carbsG: Math.round(macros.carbsG * ratio),
      fatG: Math.round(macros.fatG * ratio),
    };
  });
}

function restDayMeals(date: string, macros: MacroTargets, style: NutritionContext['dietaryStyle']) {
  return generateDailyMeals(date, macros, style);
}

function workoutTypeForRow(workout: PlannedWorkoutRow | null): NutritionContext['workoutType'] {
  if (!workout || workout.status === 'cancelled' || workout.status === 'skipped') return 'rest';
  if (workout.metadata?.sessionKind === 'cardio') return 'cardio';
  const groups = workout.suggested_muscle_groups ?? [];
  return groups.length ? inferWorkoutType(groups) : 'upper';
}

export async function syncNutritionForDate(userId: string, date: string): Promise<DayNutritionSync> {
  const db = requireAdmin();

  const [profileRes, recoveryRes, workoutRes, mealsRes] = await Promise.all([
    db.from('profiles').select('weight_kg, primary_training_goal, fitness_goals, metadata').eq('id', userId).maybeSingle(),
    db
      .from('recovery_assessments')
      .select('recovery_score, recovery_mode_active')
      .eq('user_id', userId)
      .eq('check_in_date', date)
      .maybeSingle(),
    db
      .from('planned_workouts')
      .select('id, name, scheduled_date, status, suggested_muscle_groups, metadata')
      .eq('user_id', userId)
      .eq('scheduled_date', date)
      .neq('status', 'cancelled')
      .limit(1)
      .maybeSingle(),
    db.from('meals').select('*').eq('user_id', userId).eq('scheduled_date', date),
  ]);

  const profile = profileRes.data;
  const workout = (workoutRes.data as PlannedWorkoutRow | null) ?? null;
  const isTrainingDay = !!workout && workout.status !== 'skipped';
  const workoutType = workoutTypeForRow(workout);
  const rankedGoals = resolveRankedGoals(profile?.fitness_goals, profile?.primary_training_goal);
  const dietaryStyle =
    ((profile?.metadata as { coachProfile?: { dietaryRestrictions?: string[] } })?.coachProfile?.dietaryRestrictions ??
      []).join(' ').toLowerCase().includes('keto')
      ? 'keto'
      : 'balanced';

  const macros = calculateMacroTargets({
    goal: toNutritionGoal(rankedGoals[0]),
    bodyWeightKg: profile?.weight_kg ?? undefined,
    recoveryScore: recoveryRes.data?.recovery_score ?? undefined,
    recoveryModeActive: recoveryRes.data?.recovery_mode_active ?? false,
    workoutType,
    isTrainingDay,
    dietaryStyle,
  });

  const targetMeals = isTrainingDay
    ? trainingDayMeals(date, macros, dietaryStyle)
    : restDayMeals(date, macros, dietaryStyle);
  const targetTypes = new Set<string>(targetMeals.map((m) => m.mealType));

  const existing = (mealsRes.data ?? []) as MealRow[];
  const byType = new Map(existing.map((m) => [m.meal_type, m]));

  let mealsUpdated = 0;
  let mealsInserted = 0;
  let mealsRemoved = 0;

  for (const target of targetMeals) {
    const row = byType.get(target.mealType);
    if (row) {
      const status = parseMealStatus(row.instructions);
      if (status !== 'planned') continue;
      await db
        .from('meals')
        .update({
          name: target.name,
          calories: target.calories,
          protein_g: target.proteinG,
          carbs_g: target.carbsG,
          fat_g: target.fatG,
          instructions: JSON.stringify({
            status: 'planned',
            planAdapted: true,
            adaptedAt: new Date().toISOString(),
          }),
        })
        .eq('id', row.id);
      mealsUpdated += 1;
    } else {
      await db.from('meals').insert({
        user_id: userId,
        meal_type: target.mealType,
        name: target.name,
        scheduled_date: date,
        calories: target.calories,
        protein_g: target.proteinG,
        carbs_g: target.carbsG,
        fat_g: target.fatG,
        instructions: JSON.stringify({ status: 'planned', planAdapted: true, adaptedAt: new Date().toISOString() }),
      });
      mealsInserted += 1;
    }
  }

  for (const row of existing) {
    if (targetTypes.has(row.meal_type)) continue;
    if (parseMealStatus(row.instructions) !== 'planned') continue;
    await db.from('meals').delete().eq('id', row.id);
    mealsRemoved += 1;
  }

  return {
    date,
    macros,
    mealTiming: mealTimingLabels(isTrainingDay, targetMeals.length),
    hydrationNote: hydrationNote(profile?.weight_kg ?? 75, isTrainingDay),
    isTrainingDay,
    workoutName: workout?.name,
    mealsUpdated,
    mealsInserted,
    mealsRemoved,
  };
}

export async function syncNutritionForDates(userId: string, dates: string[]): Promise<DayNutritionSync[]> {
  const unique = [...new Set(dates.filter(Boolean))].sort();
  const results: DayNutritionSync[] = [];
  for (const date of unique) {
    results.push(await syncNutritionForDate(userId, date));
  }
  return results;
}
