import { persistNutritionGoals } from '../nutritionGoals.js';
import { totalPlannedVolume } from '../programProgression.js';
import { addDays, currentProgramWeek, dayLabel, weekStartFromDate } from '../programTypes.js';
import { requireAdmin } from '../supabase.js';
import { cutPlanWeekWindow } from './cutPlanWeek.js';
import type { ParsedPersonalPlan } from './uploadedPlanTypes.js';

export const UPLOADED_PLAN_PACK_PREFIX = 'uploaded_';

export function isUploadedPlanPack(planPack?: string | null): boolean {
  return typeof planPack === 'string' && planPack.startsWith(UPLOADED_PLAN_PACK_PREFIX);
}

export type ApplyUploadedPlanResult = {
  planId: string;
  programId?: string;
  weekStart: string;
  plannedWorkouts: number;
  mealsInserted: number;
};

function planIdFor(kind: ParsedPersonalPlan['kind']): string {
  return `${UPLOADED_PLAN_PACK_PREFIX}${kind}`;
}

export async function applyUploadedPersonalPlan(
  userId: string,
  parsed: ParsedPersonalPlan,
): Promise<ApplyUploadedPlanResult> {
  const db = requireAdmin();
  const { data: profile } = await db
    .from('profiles')
    .select('metadata, timezone')
    .eq('id', userId)
    .maybeSingle();

  const { today, weekStart, weekEnd } = cutPlanWeekWindow(
    new Date(),
    profile?.timezone as string | null | undefined,
  );
  const planId = planIdFor(parsed.kind);
  const existingMeta = (profile?.metadata ?? {}) as Record<string, unknown>;
  const existingUploaded =
    (existingMeta.uploadedPlans as { workout?: ParsedPersonalPlan; nutrition?: ParsedPersonalPlan } | undefined) ?? {};
  const uploadedPlans = {
    ...existingUploaded,
    [parsed.kind]: parsed,
  };
  const coachProfile = {
    ...((existingMeta.coachProfile as Record<string, unknown>) ?? {}),
    planPack: planId,
    selfDirectedTraining: parsed.kind === 'workout' ? false : (existingMeta.coachProfile as { selfDirectedTraining?: boolean } | undefined)?.selfDirectedTraining,
    selfDirectedNutrition: parsed.kind === 'nutrition' ? false : (existingMeta.coachProfile as { selfDirectedNutrition?: boolean } | undefined)?.selfDirectedNutrition,
  };

  await db
    .from('profiles')
    .update({
      metadata: {
        ...existingMeta,
        coachProfile,
        lastUploadedPlan: {
          kind: parsed.kind,
          title: parsed.title,
          uploadedAt: new Date().toISOString(),
        },
        uploadedPlans,
      },
    })
    .eq('id', userId);

  let plannedWorkouts = 0;
  let programId: string | undefined;
  let mealsInserted = 0;

  if (parsed.kind === 'workout' && parsed.workouts?.length) {
    const { data: existingActive } = await db
      .from('training_programs')
      .select('id, created_at, metadata, duration_weeks')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();
    const existingProgramMeta = (existingActive?.metadata ?? {}) as { startDate?: string };
    const startDate = weekStartFromDate(
      existingProgramMeta.startDate ?? existingActive?.created_at?.slice(0, 10) ?? today,
    );
    let durationWeeks = existingActive?.duration_weeks ?? 12;
    const elapsedWeek = currentProgramWeek(startDate, today);
    if (elapsedWeek > durationWeeks) durationWeeks = elapsedWeek + 4;

    const { data: program, error: programError } = await db
      .from('training_programs')
      .insert({
        user_id: userId,
        name: parsed.title || 'Uploaded workout plan',
        description: 'Personal PDF workout week',
        duration_weeks: durationWeeks,
        is_active: true,
        metadata: {
          programType: 'body_part_split',
          frequency: Math.min(6, parsed.workouts.length) as 3 | 4 | 5 | 6 | 7,
          planPack: planId,
          startDate,
          planRulesVersion: 'uploaded-pdf-1',
        },
      })
      .select('id')
      .single();
    if (programError || !program) throw programError ?? new Error('Failed to create uploaded program');
    programId = program.id;
    await db.from('training_programs').update({ is_active: false }).eq('user_id', userId).neq('id', program.id);

    await db
      .from('planned_workouts')
      .update({ status: 'cancelled' })
      .eq('user_id', userId)
      .eq('status', 'planned')
      .gte('scheduled_date', weekStart)
      .lte('scheduled_date', weekEnd);

    for (const day of parsed.workouts) {
      const date = addDays(weekStart, day.dayIndex);
      const exercises = (day.exercises ?? []).map((exercise) => ({
        name: exercise.name,
        sets: exercise.sets,
        reps: exercise.reps,
        restSeconds: exercise.restSeconds ?? 90,
        notes: exercise.notes,
      }));
      const { data: template, error: templateError } = await db
        .from('workout_templates')
        .insert({
          user_id: userId,
          name: day.label,
          description: parsed.title,
          muscle_groups: day.muscleGroups ?? [],
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
        suggested_muscle_groups: day.muscleGroups ?? [],
        ai_rationale: `${dayLabel(day.dayIndex)} · uploaded PDF`,
        metadata: {
          programId: program.id,
          weekNumber: elapsedWeek,
          dayIndex: day.dayIndex,
          planPack: planId,
          exercises,
          plannedVolume: totalPlannedVolume(exercises),
        },
      });
      if (plannedError) throw plannedError;
      plannedWorkouts += 1;
    }
  }

  if (parsed.kind === 'nutrition' && (parsed.meals?.length || parsed.nutritionGoals)) {
    if (parsed.nutritionGoals) {
      await persistNutritionGoals(db, userId, {
        calories: parsed.nutritionGoals.calories ?? 2200,
        proteinG: parsed.nutritionGoals.proteinG ?? 180,
        carbsG: parsed.nutritionGoals.carbsG ?? 200,
        fatG: parsed.nutritionGoals.fatG ?? 60,
      });
    }
    if (parsed.meals?.length) {
      const { data: mealPlan, error: mealPlanError } = await db
        .from('meal_plans')
        .insert({
          user_id: userId,
          name: parsed.title || 'Uploaded nutrition plan',
          week_start_date: weekStart,
          ai_generated: true,
          ai_rationale: 'Personal nutrition PDF',
        })
        .select('id')
        .single();
      if (mealPlanError || !mealPlan) throw mealPlanError ?? new Error('Failed to create meal plan');

      for (const day of parsed.meals) {
        const date = addDays(weekStart, day.dayIndex);
        for (const meal of day.meals ?? []) {
          const { error: mealError } = await db.from('meals').insert({
            user_id: userId,
            meal_plan_id: mealPlan.id,
            meal_type: meal.mealType,
            name: meal.name,
            scheduled_date: date,
            calories: meal.calories ?? 0,
            protein_g: meal.proteinG ?? 0,
            carbs_g: meal.carbsG ?? 0,
            fat_g: meal.fatG ?? 0,
            status: 'planned',
            origin: 'plan',
            macros_provided: true,
            client_key: `upload:${planId}:${date}:${meal.mealType}:${meal.name}`,
            instructions: JSON.stringify({
              status: 'planned',
              scheduledTime: meal.scheduledTime,
              planPack: planId,
              notes: meal.notes,
            }),
          });
          if (mealError) throw mealError;
          mealsInserted += 1;
        }
      }
    }
  }

  return { planId, programId, weekStart, plannedWorkouts, mealsInserted };
}
