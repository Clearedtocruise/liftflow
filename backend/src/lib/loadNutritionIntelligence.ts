import { addDays } from './programTypes.js';
import { loadRecoveryIntelligence } from './loadRecoveryIntelligence.js';
import { requireAdmin } from './supabase.js';
import { resolveRankedGoals, toNutritionGoal } from './trainingGoals.js';
import {
  computeNutritionAdherence,
  computeNutritionIntelligence,
  inferWeightTrend,
  type NutritionEngineInput,
  type NutritionIntelligenceReport,
} from './nutritionIntelligenceEngine.js';

export async function loadNutritionIntelligence(userId: string): Promise<NutritionIntelligenceReport> {
  const db = requireAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const weekEnd = addDays(today, 6);

  const [intelligence, profileRes, sessionsRes, plannedRes, meals7dRes, todayMealsRes, hydrationRes, bodyCompRes, healthWeightRes] =
    await Promise.all([
      loadRecoveryIntelligence(userId),
      db
        .from('profiles')
        .select('weight_kg, primary_training_goal, fitness_goals, metadata')
        .eq('id', userId)
        .maybeSingle(),
      db
        .from('workout_sessions')
        .select('total_volume')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .gte('started_at', sevenDaysAgo.toISOString()),
      db
        .from('planned_workouts')
        .select('id, name, scheduled_date, status, suggested_muscle_groups')
        .eq('user_id', userId)
        .gte('scheduled_date', today)
        .lte('scheduled_date', weekEnd)
        .neq('status', 'cancelled')
        .order('scheduled_date', { ascending: true }),
      db
        .from('meals')
        .select('scheduled_date')
        .eq('user_id', userId)
        .gte('scheduled_date', sevenDaysAgo.toISOString().slice(0, 10)),
      db
        .from('meals')
        .select('calories, protein_g, carbs_g, fat_g')
        .eq('user_id', userId)
        .eq('scheduled_date', today),
      db
        .from('hydration_logs')
        .select('amount_ml')
        .eq('user_id', userId)
        .gte('logged_at', today + 'T00:00:00')
        .lte('logged_at', today + 'T23:59:59'),
      db
        .from('body_composition_records')
        .select('weight_kg, recorded_at')
        .eq('user_id', userId)
        .gte('recorded_at', fourteenDaysAgo.toISOString())
        .order('recorded_at', { ascending: true }),
      db
        .from('healthkit_sync_records')
        .select('value, recorded_at')
        .eq('user_id', userId)
        .eq('data_type', 'weight')
        .gte('recorded_at', fourteenDaysAgo.toISOString())
        .order('recorded_at', { ascending: true }),
    ]);

  const ranked = resolveRankedGoals(profileRes.data?.fitness_goals, profileRes.data?.primary_training_goal);
  const goal = toNutritionGoal(ranked[0]);
  const metadata = (profileRes.data?.metadata ?? {}) as Record<string, unknown>;
  const dietaryStyle = (metadata.dietaryStyle as NutritionEngineInput['dietaryStyle']) ?? 'balanced';

  const trainingVolume7d = (sessionsRes.data ?? []).reduce((sum, s) => sum + Number(s.total_volume ?? 0), 0);

  const plannedToday = (plannedRes.data ?? []).find((p) => p.scheduled_date === today);
  const nextPlanned = plannedToday ?? (plannedRes.data ?? [])[0];
  const muscleGroups = (nextPlanned?.suggested_muscle_groups as string[] | null) ?? [];
  const isTrainingDay = !!plannedToday || (nextPlanned?.scheduled_date === today);

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
  if (profileRes.data?.weight_kg != null && weightSamples.length === 0) {
    weightSamples.push({ weightKg: Number(profileRes.data.weight_kg), recordedAt: today });
  }

  const { trend: weightTrend, deltaKg: weightDeltaKg } = inferWeightTrend(weightSamples);
  const bodyWeightKg = weightSamples.length
    ? weightSamples[weightSamples.length - 1]!.weightKg
    : profileRes.data?.weight_kg != null
      ? Number(profileRes.data.weight_kg)
      : undefined;

  const logDays = new Set((meals7dRes.data ?? []).map((m) => m.scheduled_date)).size;
  const adherencePct = computeNutritionAdherence(logDays);

  let caloriesToday = 0;
  let proteinToday = 0;
  let carbsToday = 0;
  let fatToday = 0;
  for (const meal of todayMealsRes.data ?? []) {
    caloriesToday += Number(meal.calories ?? 0);
    proteinToday += Number(meal.protein_g ?? 0);
    carbsToday += Number(meal.carbs_g ?? 0);
    fatToday += Number(meal.fat_g ?? 0);
  }
  const waterMlToday = (hydrationRes.data ?? []).reduce((sum, h) => sum + Number(h.amount_ml ?? 0), 0);

  const trainingDaysThisWeek = (plannedRes.data ?? [])
    .filter((p) => p.status !== 'cancelled')
    .map((p) => p.scheduled_date);

  const engineInput: NutritionEngineInput = {
    userId,
    today,
    goal,
    bodyWeightKg,
    recoveryScore: intelligence.recoveryScore,
    recoveryStatus: intelligence.recoveryStatus,
    recoveryModeActive: intelligence.recoveryScore < 40,
    trainingVolume7d,
    upcomingWorkout: nextPlanned
      ? {
          date: nextPlanned.scheduled_date,
          name: nextPlanned.name,
          muscleGroups,
          isTrainingDay: isTrainingDay || nextPlanned.scheduled_date === today,
        }
      : undefined,
    weightTrend,
    weightDeltaKg,
    adherencePct,
    nutritionLogDays7d: logDays,
    intakeToday: {
      calories: caloriesToday,
      proteinG: proteinToday,
      carbsG: carbsToday,
      fatG: fatToday,
      waterMl: waterMlToday,
    },
    dietaryStyle,
    trainingDaysThisWeek,
  };

  return computeNutritionIntelligence(engineInput);
}
