import {
  aggregateDailyMeals,
  countNutritionLogDays,
  type MealRow,
} from './mealAggregation.js';
import { loadDailyMacroInputs } from './dailyMacroInputs.js';
import { loadRecoveryIntelligence } from './loadRecoveryIntelligence.js';
import { addCalendarDays, localDayRangeUtc } from './localDate.js';
import { requireAdmin } from './supabase.js';
import {
  computeNutritionAdherence,
  computeNutritionIntelligence,
  inferWeightTrend,
  type NutritionEngineInput,
  type NutritionIntelligenceReport,
} from './nutritionIntelligenceEngine.js';

const MEAL_COLUMNS =
  'id, scheduled_date, meal_type, name, meal_plan_id, calories, protein_g, carbs_g, fat_g, instructions, created_at';

export async function loadNutritionIntelligence(userId: string): Promise<NutritionIntelligenceReport> {
  const db = requireAdmin();
  const macroInputs = await loadDailyMacroInputs(userId);
  const { today, timeZone } = macroInputs;
  const sevenDaysAgo = addCalendarDays(today, -6);
  const fourteenDaysAgo = addCalendarDays(today, -14);
  const todayRange = localDayRangeUtc(today, timeZone);

  const [intelligence, meals7dRes, todayMealsRes, hydrationRes, bodyCompRes, healthWeightRes] =
    await Promise.all([
      loadRecoveryIntelligence(userId),
      db
        .from('meals')
        .select(MEAL_COLUMNS)
        .eq('user_id', userId)
        .gte('scheduled_date', sevenDaysAgo),
      db.from('meals').select(MEAL_COLUMNS).eq('user_id', userId).eq('scheduled_date', today),
      db
        .from('hydration_logs')
        .select('amount_ml')
        .eq('user_id', userId)
        .gte('logged_at', todayRange.startIso)
        .lt('logged_at', todayRange.endIso),
      db
        .from('body_composition_records')
        .select('weight_kg, recorded_at')
        .eq('user_id', userId)
        .gte('recorded_at', `${fourteenDaysAgo}T00:00:00.000Z`)
        .order('recorded_at', { ascending: true }),
      db
        .from('healthkit_sync_records')
        .select('value, recorded_at')
        .eq('user_id', userId)
        .eq('data_type', 'weight')
        .gte('recorded_at', `${fourteenDaysAgo}T00:00:00.000Z`)
        .order('recorded_at', { ascending: true }),
    ]);

  const goal = macroInputs.goal;
  const dietaryStyle = macroInputs.dietaryStyle;
  const trainingVolume7d = macroInputs.trainingVolume7d;

  const todaysWorkout = macroInputs.todaysWorkout;
  const displayWorkout = todaysWorkout ?? macroInputs.nextWorkout;
  const isTrainingDay = !!todaysWorkout;

  const weightSamples: Array<{ weightKg: number; recordedAt: string }> = [];
  for (const row of bodyCompRes.data ?? []) {
    if (row.weight_kg != null) {
      weightSamples.push({ weightKg: Number(row.weight_kg), recordedAt: row.recorded_at });
    }
  }
  for (const row of healthWeightRes.data ?? []) {
    const val = row.value as { kg?: number; value?: number } | number | null;
    const kg = typeof val === 'number' ? val : Number(val?.kg ?? val?.value ?? 0);
    if (kg > 0) weightSamples.push({ weightKg: kg, recordedAt: row.recorded_at });
  }
  // Two independently sorted sources concatenated are not sorted; the trend and the
  // "current weight" that drives every calorie figure both depend on true recency.
  weightSamples.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  if (macroInputs.profileWeightKg != null && weightSamples.length === 0) {
    weightSamples.push({ weightKg: macroInputs.profileWeightKg, recordedAt: today });
  }

  const { trend: weightTrend, deltaKg: weightDeltaKg, currentKg } = inferWeightTrend(weightSamples);
  const bodyWeightKg = currentKg ?? macroInputs.profileWeightKg;

  const meals7d = (meals7dRes.data ?? []) as MealRow[];
  const todayMeals = (todayMealsRes.data ?? []) as MealRow[];
  const todayAggregation = aggregateDailyMeals(todayMeals);

  const logDays = countNutritionLogDays(meals7d);
  const adherencePct = computeNutritionAdherence(logDays);

  const waterMlToday = (hydrationRes.data ?? []).reduce((sum, h) => sum + Number(h.amount_ml ?? 0), 0);

  const trainingDaysThisWeek = macroInputs.weekWorkouts.map((w) => w.date);
  const plannedWeek = macroInputs.weekWorkouts.map((w) => ({
    date: w.date,
    name: w.name,
    muscleGroups: w.muscleGroups,
    sessionKind: w.sessionKind,
  }));

  const todayPlanMeals =
    todayMeals.length > 0
      ? todayMeals
          .filter((m) => m.name && m.meal_type)
          .map((m) => ({
            mealType: m.meal_type as string,
            name: m.name as string,
            calories: Number(m.calories ?? 0),
            proteinG: Number(m.protein_g ?? 0),
            carbsG: Number(m.carbs_g ?? 0),
            fatG: Number(m.fat_g ?? 0),
          }))
      : undefined;

  const engineInput: NutritionEngineInput = {
    userId,
    today,
    goal,
    bodyWeightKg,
    recoveryScore: intelligence.recoveryScore,
    recoveryStatus: intelligence.recoveryStatus,
    recoveryModeActive: intelligence.recoveryScore < 40,
    trainingVolume7d,
    trainingVolumeBaseline7d: macroInputs.trainingVolumeBaseline7d,
    ageYears: macroInputs.ageYears,
    upcomingWorkout: displayWorkout
      ? {
          date: displayWorkout.date,
          name: displayWorkout.name,
          muscleGroups: displayWorkout.muscleGroups,
          isTrainingDay,
          sessionKind: displayWorkout.sessionKind,
        }
      : undefined,
    todayPlanMeals,
    weightTrend,
    weightDeltaKg,
    adherencePct,
    nutritionLogDays7d: logDays,
    intakeToday: {
      calories: todayAggregation.caloriesConsumed,
      proteinG: todayAggregation.proteinG,
      carbsG: todayAggregation.carbsG,
      fatG: todayAggregation.fatG,
      waterMl: waterMlToday,
    },
    dietaryStyle,
    trainingDaysThisWeek,
    plannedWeek,
    localHour: Number(
      new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hour12: false }).format(new Date()),
    ),
  };

  return computeNutritionIntelligence(engineInput);
}
