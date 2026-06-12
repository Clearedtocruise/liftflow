import { applyEquipmentSubstitutionsToExercises } from './equipmentSubstitutionEngine.js';
import { adaptMealName, parseMealStatus, type MealSwap } from './nutritionPreferenceEngine.js';
import { requireAdmin } from './supabase.js';
import { loadAvailableExercises, type ExerciseRecord } from './workoutPlanner.js';

export type PreferenceAdaptationTrigger = 'equipment' | 'nutrition' | 'all';

export type PreferenceAdaptationReport = {
  adapted: boolean;
  trigger: PreferenceAdaptationTrigger;
  workoutSwaps: Array<{ from: string; to: string; workoutDate: string; workoutName: string }>;
  mealSwaps: MealSwap[];
  changes: string[];
  notificationTitle: string;
  notificationBody: string;
};

type PlannedExercise = {
  name: string;
  sets: number;
  reps: string;
  weightLbs?: number;
  restSeconds: number;
  notes?: string;
};

type CoachProfileMeta = {
  dietaryRestrictions?: string[];
  foodPreferences?: string[];
  mealsPerDay?: number;
  preferredWorkoutTimes?: string[];
};

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function adaptToPreferenceChanges(
  userId: string,
  trigger: PreferenceAdaptationTrigger,
): Promise<PreferenceAdaptationReport> {
  const db = requireAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const horizon = addDays(today, 14);
  const changes: string[] = [];
  const workoutSwaps: PreferenceAdaptationReport['workoutSwaps'] = [];
  const mealSwaps: MealSwap[] = [];

  const { data: profile } = await db
    .from('profiles')
    .select('available_equipment, metadata')
    .eq('id', userId)
    .maybeSingle();

  const equipment = (profile?.available_equipment ?? []) as string[];
  const coachProfile = ((profile?.metadata ?? {}) as { coachProfile?: CoachProfileMeta }).coachProfile ?? {};

  let exercisePool: ExerciseRecord[] = [];
  if (trigger === 'equipment' || trigger === 'all') {
    exercisePool = await loadAvailableExercises(userId, equipment);
  }

  if (trigger === 'equipment' || trigger === 'all') {
    const { data: program } = await db
      .from('training_programs')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (program) {
      const { data: planned } = await db
        .from('planned_workouts')
        .select('id, name, scheduled_date, metadata, ai_rationale')
        .eq('user_id', userId)
        .contains('metadata', { programId: program.id })
        .eq('status', 'planned')
        .gte('scheduled_date', today)
        .lte('scheduled_date', horizon)
        .order('scheduled_date', { ascending: true });

      for (const workout of planned ?? []) {
        const meta = (workout.metadata ?? {}) as { exercises?: PlannedExercise[] };
        if (!meta.exercises?.length) continue;

        const { exercises, swaps } = applyEquipmentSubstitutionsToExercises(
          meta.exercises,
          equipment,
          exercisePool,
        );
        if (swaps.length === 0) continue;

        await db
          .from('planned_workouts')
          .update({
            metadata: { ...meta, exercises, equipmentAdjusted: true, equipmentAdjustedAt: new Date().toISOString() },
            ai_rationale: `${workout.ai_rationale ?? ''} · Equipment-adjusted exercises`.trim(),
          })
          .eq('id', workout.id);

        for (const swap of swaps) {
          workoutSwaps.push({
            from: swap.from,
            to: swap.to,
            workoutDate: workout.scheduled_date,
            workoutName: workout.name,
          });
          changes.push(`${workout.scheduled_date}: ${swap.from} → ${swap.to}`);
        }
      }
    }
  }

  if (trigger === 'nutrition' || trigger === 'all') {
    const { data: meals } = await db
      .from('meals')
      .select('id, name, meal_type, scheduled_date, instructions')
      .eq('user_id', userId)
      .gte('scheduled_date', today)
      .lte('scheduled_date', horizon);

    for (const meal of meals ?? []) {
      if (!meal.scheduled_date || !meal.name) continue;
      if (parseMealStatus(meal.instructions) !== 'planned') continue;

      const adapted = adaptMealName(meal.name, meal.meal_type, {
        dietaryRestrictions: coachProfile.dietaryRestrictions,
        foodPreferences: coachProfile.foodPreferences,
        mealsPerDay: coachProfile.mealsPerDay,
      });
      if (adapted.name === meal.name) continue;

      await db
        .from('meals')
        .update({
          name: adapted.name,
          instructions: JSON.stringify({
            status: 'planned',
            preferenceAdapted: true,
            adaptedAt: new Date().toISOString(),
            previousName: meal.name,
            reason: adapted.reason,
          }),
        })
        .eq('id', meal.id);

      mealSwaps.push({
        from: meal.name,
        to: adapted.name,
        date: meal.scheduled_date,
        mealType: meal.meal_type,
        reason: adapted.reason ?? 'Nutrition preference update',
      });
      changes.push(`${meal.scheduled_date} ${meal.meal_type}: ${meal.name} → ${adapted.name}`);
    }

    if (coachProfile.mealsPerDay != null) {
      changes.push(`Meal schedule set to ${coachProfile.mealsPerDay} meals per day`);
    }
    if (coachProfile.preferredWorkoutTimes?.length) {
      changes.push('Meal timing will align with your workout schedule');
    }
  }

  const adapted = changes.length > 0;
  const notificationTitle = adapted ? 'Plan updated for your preferences' : 'No changes needed';
  const notificationBody = adapted
    ? [
        workoutSwaps.length > 0 ? `${workoutSwaps.length} exercise swap(s)` : null,
        mealSwaps.length > 0 ? `${mealSwaps.length} meal update(s)` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Your current plan already matches your equipment and nutrition preferences.';

  return {
    adapted,
    trigger,
    workoutSwaps,
    mealSwaps,
    changes,
    notificationTitle,
    notificationBody,
  };
}
