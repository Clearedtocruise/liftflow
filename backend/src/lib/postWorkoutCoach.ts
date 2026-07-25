import { loadDailyMacroInputs, macroContextFrom } from './dailyMacroInputs.js';
import { localDateString } from './localDate.js';
import { requireAdmin } from './supabase.js';
import { recommendSupplements } from './supplementGuidance.js';
import { resolveRankedGoals, toNutritionGoal } from './trainingGoals.js';
import { calculateMacroTargets } from './workoutAwareNutrition.js';

export type PostWorkoutCoachSummary = {
  workoutSummary: string;
  recoveryRecommendation: string;
  nutritionRecommendation: string;
  progressionRecommendations: string[];
};

export async function generatePostWorkoutCoachSummary(
  userId: string,
  sessionId: string,
): Promise<PostWorkoutCoachSummary> {
  const db = requireAdmin();

  const { data: session } = await db
    .from('workout_sessions')
    .select('id, name, total_sets, total_volume, duration_seconds, planned_workout_id')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!session) {
    throw new Error('Session not found');
  }

  const { data: exercises } = await db
    .from('workout_exercises')
    .select('id, suggested_weight, suggested_reps, exercises(name, slug)')
    .eq('session_id', sessionId);

  // Progression compares the *last* set against the target, so the rows must be ordered.
  const { data: sets } = await db
    .from('workout_sets')
    .select('workout_exercise_id, weight, reps, is_pr, set_number, logged_at')
    .in(
      'workout_exercise_id',
      (exercises ?? []).map((e) => e.id),
    )
    .order('set_number', { ascending: true })
    .order('logged_at', { ascending: true });

  const { data: profile } = await db
    .from('profiles')
    .select('weight_kg, fitness_goals, primary_training_goal, metadata, timezone, preferred_weight_unit')
    .eq('id', userId)
    .maybeSingle();

  const today = localDateString(new Date(), profile?.timezone as string | null | undefined);
  const weightUnit = profile?.preferred_weight_unit === 'kg' ? 'kg' : 'lbs';

  const { data: recovery } = await db
    .from('recovery_assessments')
    .select('recovery_score, recovery_mode_active')
    .eq('user_id', userId)
    .eq('check_in_date', today)
    .maybeSingle();

  const { data: nutritionGoals } = await db
    .from('nutrition_goals')
    .select('protein_g, daily_calories')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  const { data: todayMeals } = await db
    .from('meals')
    .select('protein_g, calories')
    .eq('user_id', userId)
    .eq('scheduled_date', today);

  const proteinLogged = (todayMeals ?? []).reduce((sum, m) => sum + (m.protein_g ?? 0), 0);
  const caloriesLogged = (todayMeals ?? []).reduce((sum, m) => sum + Number(m.calories ?? 0), 0);
  // A flat constant would report the same "target" to a 55kg cutting user and a 110kg bulking one,
  // so an absent goal row falls back to the same computed targets the nutrition screens show.
  const computedTargets = calculateMacroTargets(macroContextFrom(await loadDailyMacroInputs(userId)));
  const proteinTarget = nutritionGoals?.protein_g ?? computedTargets.proteinG;
  const calorieTarget = nutritionGoals?.daily_calories ?? computedTargets.calories;
  const recoveryScore: number | undefined = recovery?.recovery_score ?? undefined;

  const durationMin = Math.round((session.duration_seconds ?? 0) / 60);
  const prCount = (sets ?? []).filter((s) => s.is_pr).length;

  const workoutSummary = `Completed ${session.name}: ${session.total_sets ?? 0} sets, ${Math.round(session.total_volume ?? 0)} total volume in ${durationMin} min${prCount ? ` — ${prCount} PR${prCount > 1 ? 's' : ''}!` : '.'}`;

  // No check-in means no recovery reading; saying "moderate" would present a default as a measurement.
  const recoveryRecommendation =
    recoveryScore == null
      ? recovery?.recovery_mode_active
        ? 'Recovery Mode is active. Prioritize sleep and keep tomorrow lighter if soreness persists.'
        : 'No recovery check-in logged today, so this is general guidance: aim for 7–9 hours of sleep and log a check-in to get a recovery-aware recommendation.'
      : recoveryScore < 50 || recovery?.recovery_mode_active
        ? 'Recovery is low. Prioritize 7–9 hours of sleep tonight and keep tomorrow lighter if soreness persists.'
        : recoveryScore >= 80
          ? 'Recovery is high. You can push intensity on your next session if warm-ups feel strong.'
          : 'Recovery is moderate. Stay consistent and monitor sleep quality over the next 48 hours.';

  const calorieNote = ` Calories ${Math.round(caloriesLogged)} / ${calorieTarget} logged today.`;
  const nutritionRecommendation =
    (proteinLogged < proteinTarget * 0.7
      ? `Protein intake is below target (${Math.round(proteinLogged)}g / ${proteinTarget}g). Add a post-workout protein meal within 2 hours.`
      : `Protein on track (${Math.round(proteinLogged)}g / ${proteinTarget}g). Maintain hydration and balanced carbs tonight.`) + calorieNote;

  const progressionRecommendations: string[] = [];

  for (const ex of exercises ?? []) {
    const exSets = (sets ?? []).filter((s) => s.workout_exercise_id === ex.id);
    if (exSets.length === 0) continue;

    const exName =
      (ex.exercises as { name?: string; slug?: string } | null)?.name ?? 'Exercise';
    const targetReps = parseInt(String(ex.suggested_reps ?? '8').match(/\d+/)?.[0] ?? '8', 10);
    const lastSet = exSets[exSets.length - 1];
    const hitTarget = (lastSet.reps ?? 0) >= targetReps;

    if (hitTarget && ex.suggested_weight) {
      const increase = Math.max(2.5, Math.round(ex.suggested_weight * 0.025 * 2) / 2);
      progressionRecommendations.push(
        `${exName}: increase by ${increase} ${weightUnit} next session if you hit ${targetReps} reps again.`,
      );
    } else if ((lastSet.reps ?? 0) < targetReps - 2) {
      progressionRecommendations.push(
        `${exName}: reduce load slightly or keep weight and aim for ${targetReps - 1}–${targetReps} reps.`,
      );
    }
  }

  if (progressionRecommendations.length === 0) {
    progressionRecommendations.push('Maintain current loads and focus on rep quality before increasing weight.');
  }

  const ranked = resolveRankedGoals(profile?.fitness_goals, profile?.primary_training_goal);
  const supplements = recommendSupplements({
    goal: toNutritionGoal(ranked[0]),
    bodyWeightKg: profile?.weight_kg ?? undefined,
    daysPerWeek: ((profile?.metadata ?? {}) as { coachProfile?: { daysPerWeek?: number } }).coachProfile?.daysPerWeek,
  });

  if (supplements.length > 0) {
    progressionRecommendations.push(
      `Supplement note: ${supplements[0]?.name} — ${supplements[0]?.rationale}`,
    );
  }

  return {
    workoutSummary,
    recoveryRecommendation,
    nutritionRecommendation,
    progressionRecommendations,
  };
}
