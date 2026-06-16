/**
 * Weekly closeout — aggregates training, nutrition, recovery, and progress.
 * Archives completed weeks; next-week plans are staged separately.
 */
import { generateWeeklyMealPlan } from './aiCoach.js';
import { loadRecoveryIntelligence } from './loadRecoveryIntelligence.js';
import { weekStartDateString } from './localDate.js';
import { buildNextWeekWorkoutPreview } from './nextWeekPlanner.js';
import { requireAdmin } from './supabase.js';

export type WeeklyTrainingSummary = {
  workoutsCompleted: number;
  workoutsPlanned: number;
  workoutsMissed: string[];
  totalExercises: number;
  totalSets: number;
  totalVolumeKg: number;
  cardioSessions: number;
  sportsSessions: number;
  prs: Array<{ exerciseName: string; detail: string }>;
  bestLifts: Array<{ exerciseName: string; weightKg: number; reps: number }>;
  consistencyScore: number;
  coachSummary: string;
};

export type WeeklyNutritionSummary = {
  daysTracked: number;
  mealsCompleted: number;
  mealsPlanned: number;
  avgCalories: number;
  targetCalories: number;
  avgProteinG: number;
  targetProteinG: number;
  adherencePct: number;
  highestAdherenceDay: string | null;
  lowestAdherenceDay: string | null;
  missedMeals: number;
  coachSummary: string;
};

export type WeeklyRecoverySummary = {
  avgRecoveryScore: number;
  checkInsCompleted: number;
  trainingRecommendation: string;
  coachSummary: string;
};

export type WeeklyProgressSummary = {
  volumeChangePct: number | null;
  workoutAdherencePct: number;
  nutritionAdherencePct: number;
  coachSummary: string;
};

export type WeeklyCloseoutSummary = {
  weekStartDate: string;
  weekEndDate: string;
  training: WeeklyTrainingSummary;
  nutrition: WeeklyNutritionSummary;
  recovery: WeeklyRecoverySummary;
  progress: WeeklyProgressSummary;
};

export type NextWeekPlanPreview = {
  weekStartDate: string;
  weekEndDate: string;
  focus: string;
  workoutDays: Array<{
    date: string;
    dayLabel: string;
    title: string;
    muscleGroups: string[];
    exerciseCount: number;
  }>;
  nutrition: {
    dailyCalories: number;
    dailyProteinG: number;
    coachSummary: string;
    days: Array<{ day: string; calories: number; proteinG: number; label: string }>;
  };
};

export type WeeklyCloseoutRecord = {
  id: string;
  weekStartDate: string;
  weekEndDate: string;
  status: 'pending_review' | 'accepted' | 'archived';
  summary: WeeklyCloseoutSummary;
  nextWeekPlan: NextWeekPlanPreview;
};

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function weekEndDate(weekStart: string): string {
  return addDays(weekStart, 6);
}

function mealStatusFromInstructions(instructions: string | null): string {
  if (!instructions) return 'planned';
  try {
    const parsed = JSON.parse(instructions) as { status?: string };
    return parsed.status ?? 'planned';
  } catch {
    return 'planned';
  }
}

function buildTrainingCoachSummary(input: {
  completed: number;
  planned: number;
  missed: string[];
  volumeKg: number;
  prCount: number;
}): string {
  const parts: string[] = [];
  if (input.completed >= input.planned) {
    parts.push('Strong training consistency this week.');
  } else if (input.completed >= Math.ceil(input.planned * 0.7)) {
    parts.push('Solid week overall with room to tighten schedule adherence.');
  } else {
    parts.push('Several planned sessions were missed — next week will prioritize catch-up volume.');
  }
  if (input.missed.some((m) => /lower|leg/i.test(m))) {
    parts.push('Lower-body volume was slightly low.');
  }
  if (input.prCount > 0) {
    parts.push(`${input.prCount} new PR${input.prCount > 1 ? 's' : ''} logged.`);
  }
  parts.push(`Total volume ${Math.round(input.volumeKg).toLocaleString()} kg.`);
  return parts.join(' ');
}

function buildNutritionCoachSummary(adherencePct: number, avgProtein: number, targetProtein: number): string {
  const parts: string[] = [];
  if (avgProtein >= targetProtein * 0.9) parts.push('Protein was strong.');
  else parts.push('Protein ran slightly below target on several days.');
  if (adherencePct >= 85) parts.push('Macro adherence was excellent.');
  else if (adherencePct >= 70) parts.push('Calories were close to target most days.');
  else parts.push('Calories were inconsistent — next week adds clearer post-workout meals.');
  return parts.join(' ');
}

export async function buildWeeklyCloseoutSummary(
  userId: string,
  weekStartDate: string,
): Promise<WeeklyCloseoutSummary> {
  const db = requireAdmin();
  const weekEnd = weekEndDate(weekStartDate);
  const weekStartIso = `${weekStartDate}T00:00:00.000Z`;
  const weekEndIso = `${addDays(weekEnd, 1)}T00:00:00.000Z`;

  const [plannedRes, sessionsRes, setsRes, cardioRes, mealsRes, recoveryRes, goalsRes, prevSessionsRes] =
    await Promise.all([
      db
        .from('planned_workouts')
        .select('id, name, scheduled_date, status, metadata, suggested_muscle_groups')
        .eq('user_id', userId)
        .gte('scheduled_date', weekStartDate)
        .lte('scheduled_date', weekEnd)
        .order('scheduled_date'),
      db
        .from('workout_sessions')
        .select('id, name, started_at, status, total_volume, planned_workout_id')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .gte('started_at', weekStartIso)
        .lt('started_at', weekEndIso),
      db
        .from('workout_sets')
        .select('weight, reps, is_pr, workout_exercises!inner(workout_sessions!inner(user_id, started_at), exercises(name))')
        .eq('workout_exercises.workout_sessions.user_id', userId)
        .gte('workout_exercises.workout_sessions.started_at', weekStartIso)
        .lt('workout_exercises.workout_sessions.started_at', weekEndIso),
      db
        .from('cardio_sessions')
        .select('id, cardio_type, duration_seconds, metadata, started_at')
        .eq('user_id', userId)
        .gte('started_at', weekStartIso)
        .lt('started_at', weekEndIso),
      db
        .from('meals')
        .select('scheduled_date, calories, protein_g, instructions, meal_type')
        .eq('user_id', userId)
        .gte('scheduled_date', weekStartDate)
        .lte('scheduled_date', weekEnd),
      db
        .from('recovery_assessments')
        .select('recovery_score, check_in_date')
        .eq('user_id', userId)
        .gte('check_in_date', weekStartDate)
        .lte('check_in_date', weekEnd),
      db.from('nutrition_goals').select('daily_calories, protein_g').eq('user_id', userId).eq('is_active', true).maybeSingle(),
      db
        .from('workout_sessions')
        .select('total_volume')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .gte('started_at', addDays(weekStartDate, -7) + 'T00:00:00.000Z')
        .lt('started_at', weekStartIso),
    ]);

  const planned = plannedRes.data ?? [];
  const liftingPlanned = planned.filter((p) => {
    const meta = p.metadata as { sessionKind?: string } | null;
    return meta?.sessionKind !== 'cardio';
  });
  const completedSessionIds = new Set((sessionsRes.data ?? []).map((s) => s.id));
  const completedPlanned = liftingPlanned.filter((p) => p.status === 'completed' || p.status === 'in_progress');
  const missed = liftingPlanned
    .filter((p) => p.status === 'planned' && !completedPlanned.some((c) => c.scheduled_date === p.scheduled_date))
    .map((p) => p.name);

  const sets = setsRes.data ?? [];
  let totalVolumeKg = 0;
  const prs: WeeklyTrainingSummary['prs'] = [];
  const bestByExercise = new Map<string, { weightKg: number; reps: number }>();

  for (const set of sets) {
    const w = Number(set.weight ?? 0);
    const r = Number(set.reps ?? 0);
    totalVolumeKg += w * r;
    const we = set.workout_exercises as { exercises?: { name?: string } } | undefined;
    const name = we?.exercises?.name ?? 'Exercise';
    if (set.is_pr) {
      prs.push({ exerciseName: name, detail: `${w} kg × ${r}` });
    }
    const prev = bestByExercise.get(name);
    const est1rm = w * (1 + r / 30);
    const prevEst = prev ? prev.weightKg * (1 + prev.reps / 30) : 0;
    if (est1rm > prevEst) bestByExercise.set(name, { weightKg: w, reps: r });
  }

  const cardio = cardioRes.data ?? [];
  const sportsSessions = cardio.filter((c) => {
    const meta = c.metadata as { activityKind?: string; sport?: string } | null;
    return meta?.activityKind === 'sport' || meta?.sport != null || c.cardio_type === 'sport';
  }).length;

  const exerciseIds = new Set(
    sets.map((s) => (s.workout_exercises as { id?: string } | undefined)?.id).filter(Boolean),
  );

  const workoutsCompleted = sessionsRes.data?.length ?? 0;
  const workoutsPlanned = liftingPlanned.length;
  const consistencyScore =
    workoutsPlanned > 0 ? Math.round((workoutsCompleted / workoutsPlanned) * 100) : workoutsCompleted > 0 ? 100 : 0;

  const meals = mealsRes.data ?? [];
  const byDate = new Map<string, typeof meals>();
  for (const meal of meals) {
    const bucket = byDate.get(meal.scheduled_date) ?? [];
    bucket.push(meal);
    byDate.set(meal.scheduled_date, bucket);
  }

  let mealsCompleted = 0;
  let mealsPlanned = 0;
  let caloriesSum = 0;
  let proteinSum = 0;
  let daysTracked = 0;
  let missedMeals = 0;
  let bestDay: { date: string; score: number } | null = null;
  let worstDay: { date: string; score: number } | null = null;

  for (const [date, dayMeals] of byDate.entries()) {
    let dayCompleted = 0;
    let dayPlanned = 0;
    let dayCal = 0;
    let dayTarget = 0;
    for (const meal of dayMeals) {
      const status = mealStatusFromInstructions(meal.instructions);
      if (status === 'skipped') continue;
      dayPlanned += 1;
      mealsPlanned += 1;
      dayTarget += meal.calories ?? 0;
      if (status === 'completed' || status === 'modified') {
        dayCompleted += 1;
        mealsCompleted += 1;
        dayCal += meal.calories ?? 0;
        caloriesSum += meal.calories ?? 0;
        proteinSum += Number(meal.protein_g ?? 0);
      } else {
        missedMeals += 1;
      }
    }
    if (dayCal > 0) daysTracked += 1;
    if (dayPlanned > 0) {
      const score = dayCompleted / dayPlanned;
      if (!bestDay || score > bestDay.score) bestDay = { date, score };
      if (!worstDay || score < worstDay.score) worstDay = { date, score };
    }
  }

  const targetCalories = goalsRes.data?.daily_calories ?? 2400;
  const targetProteinG = goalsRes.data?.protein_g ?? 180;
  const trackedDays = Math.max(daysTracked, 1);
  const avgCalories = Math.round(caloriesSum / trackedDays);
  const avgProteinG = Math.round(proteinSum / trackedDays);
  const adherencePct =
    mealsPlanned > 0 ? Math.round((mealsCompleted / mealsPlanned) * 100) : 0;

  const recoveryRows = recoveryRes.data ?? [];
  const avgRecoveryScore =
    recoveryRows.length > 0
      ? Math.round(recoveryRows.reduce((s, r) => s + (r.recovery_score ?? 0), 0) / recoveryRows.length)
      : 72;

  let intelligence;
  try {
    intelligence = await loadRecoveryIntelligence(userId);
  } catch {
    intelligence = null;
  }

  const prevVolume = (prevSessionsRes.data ?? []).reduce((s, r) => s + Number(r.total_volume ?? 0), 0);
  const volumeChangePct =
    prevVolume > 0 ? Math.round(((totalVolumeKg - prevVolume) / prevVolume) * 100) : null;

  const training: WeeklyTrainingSummary = {
    workoutsCompleted,
    workoutsPlanned,
    workoutsMissed: missed,
    totalExercises: exerciseIds.size,
    totalSets: sets.length,
    totalVolumeKg: Math.round(totalVolumeKg),
    cardioSessions: cardio.length,
    sportsSessions,
    prs,
    bestLifts: [...bestByExercise.entries()].slice(0, 5).map(([exerciseName, lift]) => ({
      exerciseName,
      ...lift,
    })),
    consistencyScore,
    coachSummary: buildTrainingCoachSummary({
      completed: workoutsCompleted,
      planned: workoutsPlanned,
      missed,
      volumeKg: totalVolumeKg,
      prCount: prs.length,
    }),
  };

  const nutrition: WeeklyNutritionSummary = {
    daysTracked,
    mealsCompleted,
    mealsPlanned,
    avgCalories,
    targetCalories,
    avgProteinG,
    targetProteinG,
    adherencePct,
    highestAdherenceDay: bestDay?.date ?? null,
    lowestAdherenceDay: worstDay?.date ?? null,
    missedMeals,
    coachSummary: buildNutritionCoachSummary(adherencePct, avgProteinG, targetProteinG),
  };

  const recovery: WeeklyRecoverySummary = {
    avgRecoveryScore,
    checkInsCompleted: recoveryRows.length,
    trainingRecommendation: intelligence?.trainingRecommendationLabel ?? 'Train',
    coachSummary: intelligence?.rationale ?? 'Complete recovery check-ins for sharper weekly guidance.',
  };

  const progress: WeeklyProgressSummary = {
    volumeChangePct,
    workoutAdherencePct: consistencyScore,
    nutritionAdherencePct: adherencePct,
    coachSummary:
      consistencyScore >= 80 && adherencePct >= 80
        ? 'Training and nutrition aligned well this week.'
        : 'Focus next week on matching nutrition to training days.',
  };

  return {
    weekStartDate,
    weekEndDate: weekEnd,
    training,
    nutrition,
    recovery,
    progress,
  };
}

export async function prepareWeeklyCloseout(userId: string, referenceDate?: string): Promise<WeeklyCloseoutRecord> {
  const db = requireAdmin();
  const today = referenceDate ?? new Date().toISOString().slice(0, 10);
  const weekStart = weekStartDateString(today);
  const weekEnd = weekEndDate(weekStart);

  const summary = await buildWeeklyCloseoutSummary(userId, weekStart);
  const workoutPreview = await buildNextWeekWorkoutPreview(userId, addDays(weekStart, 7));
  const mealTemplate = generateWeeklyMealPlan(summary.nutrition.targetProteinG, summary.nutrition.targetCalories);
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const nextWeekPlan: NextWeekPlanPreview = {
    weekStartDate: addDays(weekStart, 7),
    weekEndDate: addDays(weekEnd, 7),
    focus: workoutPreview.focus,
    workoutDays: workoutPreview.days,
    nutrition: {
      dailyCalories: summary.nutrition.targetCalories,
      dailyProteinG: summary.nutrition.targetProteinG,
      coachSummary: mealTemplate.aiRationale ?? 'Meals aligned to next week training load.',
      days: dayLabels.map((day) => ({
        day,
        calories: summary.nutrition.targetCalories,
        proteinG: summary.nutrition.targetProteinG,
        label: `${day} · ${mealTemplate.meals.filter((m) => m.scheduledDate).length > 0 ? 'Training-aligned meals' : 'Meal plan'}`,
      })),
    },
  };

  const payload = {
    user_id: userId,
    week_start_date: weekStart,
    week_end_date: weekEnd,
    status: 'pending_review',
    summary,
    next_week_plan: nextWeekPlan,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await db
    .from('weekly_closeouts')
    .upsert(payload, { onConflict: 'user_id,week_start_date' })
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  return {
    id: data.id,
    weekStartDate: data.week_start_date,
    weekEndDate: data.week_end_date,
    status: data.status,
    summary: data.summary as WeeklyCloseoutSummary,
    nextWeekPlan: data.next_week_plan as NextWeekPlanPreview,
  };
}

export async function acceptWeeklyCloseout(userId: string, closeoutId: string): Promise<WeeklyCloseoutRecord> {
  const db = requireAdmin();
  const { data: existing, error: fetchError } = await db
    .from('weekly_closeouts')
    .select('*')
    .eq('id', closeoutId)
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!existing) throw new Error('Weekly closeout not found');

  const { data, error } = await db
    .from('weekly_closeouts')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', closeoutId)
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  return {
    id: data.id,
    weekStartDate: data.week_start_date,
    weekEndDate: data.week_end_date,
    status: data.status,
    summary: data.summary as WeeklyCloseoutSummary,
    nextWeekPlan: data.next_week_plan as NextWeekPlanPreview,
  };
}

export async function getWeeklyCloseoutStatus(
  userId: string,
  weekStartDate?: string,
): Promise<WeeklyCloseoutRecord | null> {
  const db = requireAdmin();
  const weekStart = weekStartDate ?? weekStartDateString(new Date().toISOString().slice(0, 10));

  const { data, error } = await db
    .from('weekly_closeouts')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start_date', weekStart)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id: data.id,
    weekStartDate: data.week_start_date,
    weekEndDate: data.week_end_date,
    status: data.status,
    summary: data.summary as WeeklyCloseoutSummary,
    nextWeekPlan: data.next_week_plan as NextWeekPlanPreview,
  };
}
