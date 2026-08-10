import { localDateString } from '../localDate.js';
import { removePlannedMealsForWeek } from '../mealCleanup.js';
import { persistNutritionGoals } from '../nutritionGoals.js';
import { totalPlannedVolume } from '../programProgression.js';
import { addDays, currentProgramWeek, dayLabel, weekStartFromDate } from '../programTypes.js';
import { requireAdmin } from '../supabase.js';
import type { GeneratedWorkoutExercise } from '../workoutPlanner.js';
import {
  AGGRESSIVE_CUT_NUTRITION_DAYS,
  AGGRESSIVE_CUT_NUTRITION_GOALS,
} from './aggressiveCutMeals.js';
import {
  AGGRESSIVE_CUT_PLAN_ID,
  AGGRESSIVE_CUT_PROGRAM_NAME,
  AGGRESSIVE_CUT_WORKOUT_DAYS,
} from './aggressiveCutWorkouts.js';

export type LoadAggressiveCutResult = {
  planId: typeof AGGRESSIVE_CUT_PLAN_ID;
  programId: string;
  weekStart: string;
  plannedWorkouts: number;
  mealsInserted: number;
  mealsCleared: number;
};

function toGeneratedExercises(day: (typeof AGGRESSIVE_CUT_WORKOUT_DAYS)[number]): GeneratedWorkoutExercise[] {
  return day.exercises.map((exercise) => ({
    name: exercise.name,
    sets: exercise.sets,
    reps: exercise.reps,
    restSeconds: exercise.restSeconds,
    notes: exercise.notes,
  }));
}

/**
 * Loads the athlete's PDF cut plan as the active training week + meal week.
 *
 * Sticky via `training_programs.metadata.planPack` and `coachProfile.planPack` so weekly
 * regenerate can reload the same blueprint instead of inventing a new split.
 */
export async function loadAggressiveCutPlan(userId: string): Promise<LoadAggressiveCutResult> {
  const db = requireAdmin();

  const { data: profile } = await db
    .from('profiles')
    .select('metadata, primary_training_goal, fitness_goals, timezone')
    .eq('id', userId)
    .maybeSingle();

  // Match the Nutrition/Workout tabs: week windows are local to the athlete, not UTC.
  const today = localDateString(new Date(), profile?.timezone as string | null | undefined);
  const weekStart = weekStartFromDate(today);
  const weekEnd = addDays(weekStart, 6);

  const existingMeta = (profile?.metadata ?? {}) as Record<string, unknown>;
  const coachProfile = {
    ...((existingMeta.coachProfile as Record<string, unknown>) ?? {}),
    daysPerWeek: 6,
    planPack: AGGRESSIVE_CUT_PLAN_ID,
    selfDirectedTraining: false,
    selfDirectedNutrition: false,
    goalWeightKg: Math.round(180 / 2.2046226218),
  };

  await db
    .from('profiles')
    .update({
      primary_training_goal: 'fat_loss',
      fitness_goals: ['fat_loss', 'strength'],
      metadata: {
        ...existingMeta,
        coachProfile,
        coachActivation: {
          ...((existingMeta.coachActivation as Record<string, unknown>) ?? {}),
          programType: 'body_part_split',
          frequency: 6,
          planPack: AGGRESSIVE_CUT_PLAN_ID,
        },
      },
    })
    .eq('id', userId);

  await persistNutritionGoals(db, userId, {
    calories: AGGRESSIVE_CUT_NUTRITION_GOALS.calories,
    proteinG: AGGRESSIVE_CUT_NUTRITION_GOALS.proteinG,
    carbsG: AGGRESSIVE_CUT_NUTRITION_GOALS.carbsG,
    fatG: AGGRESSIVE_CUT_NUTRITION_GOALS.fatG,
  });
  // One gallon ≈ 3785 ml — override the default 3000 from persistNutritionGoals.
  await db
    .from('nutrition_goals')
    .update({ water_ml: 3785 })
    .eq('user_id', userId)
    .eq('is_active', true);

  const { data: existingActive } = await db
    .from('training_programs')
    .select('id, created_at, metadata, duration_weeks')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  const existingProgramMeta = (existingActive?.metadata ?? {}) as { startDate?: string };
  const startDate = weekStartFromDate(existingProgramMeta.startDate ?? existingActive?.created_at?.slice(0, 10) ?? today);
  let durationWeeks = existingActive?.duration_weeks ?? 12;
  const elapsedWeek = currentProgramWeek(startDate, today);
  if (elapsedWeek > durationWeeks) durationWeeks = elapsedWeek + 4;

  const schedule = [
    ...AGGRESSIVE_CUT_WORKOUT_DAYS.map((day) => ({
      label: day.label,
      isRest: false,
    })),
    { label: 'Rest', isRest: true },
  ];

  const { data: program, error: programError } = await db
    .from('training_programs')
    .insert({
      user_id: userId,
      name: AGGRESSIVE_CUT_PROGRAM_NAME,
      description: 'Home gym cut · 193→180 · fixed PDF prescriptions',
      duration_weeks: durationWeeks,
      is_active: true,
      metadata: {
        programType: 'body_part_split',
        frequency: 6,
        goal: 'fat_loss',
        experience: 'intermediate',
        planPack: AGGRESSIVE_CUT_PLAN_ID,
        startDate,
        schedule,
        planRulesVersion: 'aggressive-cut-pdf-1',
      },
    })
    .select('id')
    .single();

  if (programError || !program) throw programError ?? new Error('Failed to create cut program');

  await db.from('training_programs').update({ is_active: false }).eq('user_id', userId).neq('id', program.id);

  // Cancel leftover planned rows in this calendar week before inserting the PDF week.
  await db
    .from('planned_workouts')
    .update({ status: 'cancelled' })
    .eq('user_id', userId)
    .eq('status', 'planned')
    .gte('scheduled_date', weekStart)
    .lte('scheduled_date', weekEnd);

  let plannedWorkouts = 0;
  for (const day of AGGRESSIVE_CUT_WORKOUT_DAYS) {
    const date = addDays(weekStart, day.dayIndex);
    const exercises = toGeneratedExercises(day);

    const { data: template, error: templateError } = await db
      .from('workout_templates')
      .insert({
        user_id: userId,
        name: day.label,
        description: `Aggressive cut · ${day.label}`,
        muscle_groups: day.muscleGroups,
        estimated_duration_minutes: Math.max(45, exercises.length * 8),
        exercises,
        is_system: false,
      })
      .select('id')
      .single();

    if (templateError) throw templateError;

    const { error: plannedError } = await db.from('planned_workouts').insert({
      user_id: userId,
      template_id: template.id,
      name: `${day.label} — Week ${elapsedWeek}`,
      scheduled_date: date,
      status: 'planned',
      suggested_muscle_groups: day.muscleGroups,
      ai_rationale: `${dayLabel(day.dayIndex)} · Aggressive cut PDF plan`,
      metadata: {
        programId: program.id,
        weekNumber: elapsedWeek,
        dayIndex: day.dayIndex,
        dayLabel: dayLabel(day.dayIndex),
        slotLabel: day.label,
        sprintPhase: 'accumulation',
        planPack: AGGRESSIVE_CUT_PLAN_ID,
        exercises,
        plannedVolume: totalPlannedVolume(exercises),
      },
    });

    if (plannedError) throw plannedError;
    plannedWorkouts += 1;
  }

  const mealsCleared = await removePlannedMealsForWeek(db, userId, weekStart, weekEnd);

  const { data: mealPlan, error: mealPlanError } = await db
    .from('meal_plans')
    .insert({
      user_id: userId,
      name: 'Aggressive Cut Nutrition',
      week_start_date: weekStart,
      ai_generated: false,
      ai_rationale: 'Fixed meals from cut nutrition PDF · 2100–2250 kcal · 210g protein',
    })
    .select('id')
    .single();

  if (mealPlanError || !mealPlan) throw mealPlanError ?? new Error('Failed to create meal plan');

  let mealsInserted = 0;
  for (const day of AGGRESSIVE_CUT_NUTRITION_DAYS) {
    const date = addDays(weekStart, day.dayIndex);
    for (const meal of day.meals) {
      const { error: mealError } = await db.from('meals').insert({
        user_id: userId,
        meal_plan_id: mealPlan.id,
        meal_type: meal.mealType,
        name: meal.name,
        scheduled_date: date,
        calories: meal.calories,
        protein_g: meal.proteinG,
        carbs_g: meal.carbsG,
        fat_g: meal.fatG,
        status: 'planned',
        origin: 'plan',
        macros_provided: true,
        client_key: `cut:${AGGRESSIVE_CUT_PLAN_ID}:${date}:${meal.mealType}:${meal.scheduledTime}`,
        instructions: JSON.stringify({
          status: 'planned',
          scheduledTime: meal.scheduledTime,
          planPack: AGGRESSIVE_CUT_PLAN_ID,
          liftTime: day.liftTime,
          notes: meal.notes,
        }),
      });
      if (mealError) throw mealError;
      mealsInserted += 1;
    }
  }

  return {
    planId: AGGRESSIVE_CUT_PLAN_ID,
    programId: program.id,
    weekStart,
    plannedWorkouts,
    mealsInserted,
    mealsCleared,
  };
}
