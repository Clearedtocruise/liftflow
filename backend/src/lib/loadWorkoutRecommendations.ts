import { loadRecoveryIntelligence } from './loadRecoveryIntelligence.js';
import { localDateString, weekStartDateString } from './localDate.js';
import { addDays } from './programTypes.js';
import { requireAdmin } from './supabase.js';
import { resolveRankedGoals } from './trainingGoals.js';
import { buildAdaptiveWorkoutPlan, type GeneratedWorkoutPlan } from './workoutPlanner.js';
import {
    coerceTrainingRecommendationForSchedule,
    computeWorkoutRecommendations,
    inferDaysPerWeek,
    inferSplitFromProfile,
    type RecommendationEngineInput,
    type WorkoutRecommendationReport,
} from './workoutRecommendationEngine.js';

export async function loadWorkoutRecommendations(userId: string): Promise<WorkoutRecommendationReport> {
  const db = requireAdmin();

  const profileRes = await db
    .from('profiles')
    .select('fitness_goals, primary_training_goal, metadata, timezone')
    .eq('id', userId)
    .maybeSingle();

  const profileTimeZone = (profileRes.data?.timezone as string | null | undefined) ?? null;
  const today = localDateString(new Date(), profileTimeZone);
  const weekStartStr = weekStartDateString(today);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [intelligence, sessionsRes, plannedRes] = await Promise.all([
    loadRecoveryIntelligence(userId),
    db
      .from('workout_sessions')
      .select('started_at, workout_exercises(exercises(muscle_groups), workout_sets(weight, reps))')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('started_at', sevenDaysAgo.toISOString()),
    db
      .from('planned_workouts')
      .select('id, name, scheduled_date, status, suggested_muscle_groups')
      .eq('user_id', userId)
      .gte('scheduled_date', weekStartStr)
      .lte('scheduled_date', addDays(today, 6)),
  ]);

  const ranked = resolveRankedGoals(profileRes.data?.fitness_goals, profileRes.data?.primary_training_goal);
  const metadata = (profileRes.data?.metadata ?? {}) as Record<string, unknown>;
  const sessions7d = sessionsRes.data?.length ?? 0;
  const daysPerWeek = inferDaysPerWeek(metadata, sessions7d);
  const splitStyle = inferSplitFromProfile(ranked, profileRes.data?.primary_training_goal ?? undefined, daysPerWeek, metadata);

  const weeklyMuscleVolume = new Map<string, number>();
  for (const session of sessionsRes.data ?? []) {
    for (const we of (session as {
      workout_exercises?: Array<{
        exercises?: { muscle_groups?: string[] };
        workout_sets?: Array<{ weight: number | null; reps: number | null }>;
      }>;
    }).workout_exercises ?? []) {
      const groups = we.exercises?.muscle_groups ?? [];
      let setVol = 0;
      for (const set of we.workout_sets ?? []) {
        setVol += Number(set.weight ?? 0) * Number(set.reps ?? 0);
      }
      const share = setVol / Math.max(1, groups.length);
      for (const mg of groups) {
        weeklyMuscleVolume.set(mg, (weeklyMuscleVolume.get(mg) ?? 0) + share);
      }
    }
  }

  const plannedRows = plannedRes.data ?? [];
  const completedThisWeek = plannedRows.filter((p) => p.status === 'completed').length;
  const plannedThisWeek = plannedRows.filter((p) => p.status !== 'cancelled').length;
  const missedWorkouts = plannedRows
    .filter((p) => p.status === 'planned' && p.scheduled_date < today)
    .map((p) => ({
      date: p.scheduled_date,
      name: p.name,
      muscleGroups: (p.suggested_muscle_groups as string[] | null) ?? [],
    }));

  const nextPlanned = plannedRows
    .filter((p) => p.status === 'planned' && p.scheduled_date >= today)
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))[0];

  const hasScheduledWorkoutToday = nextPlanned?.scheduled_date === today;
  const trainingRecommendation = coerceTrainingRecommendationForSchedule(
    intelligence.trainingRecommendation,
    hasScheduledWorkoutToday,
  );

  const engineInput: RecommendationEngineInput = {
    userId,
    today,
    recoveryScore: intelligence.recoveryScore,
    recoveryStatus: intelligence.recoveryStatus,
    trainingRecommendation,
    suggestedMuscleGroups: intelligence.suggestedMuscleGroups,
    avoidMuscleGroups: intelligence.avoidMuscleGroups,
    muscleRecovery: intelligence.muscleRecovery.map((m) => ({
      muscle: m.muscle,
      score: m.score,
      hoursSinceTraining: m.hoursSinceTraining,
      weeklyVolume: m.weeklyVolume,
    })),
    fitnessGoals: ranked,
    primaryGoal: ranked[0] ?? 'general_fitness',
    daysPerWeek,
    splitStyle,
    weeklyMuscleVolume,
    missedWorkouts,
    plannedThisWeek,
    completedThisWeek,
    sessions7d,
    activeProgramSlot:
      nextPlanned?.scheduled_date === today
        ? {
            label: nextPlanned.name,
            muscleGroups: (nextPlanned.suggested_muscle_groups as string[] | null) ?? [],
            date: today,
          }
        : undefined,
  };

  const rationaleBase = `Based on ${sessions7d} logged sessions, recovery ${intelligence.recoveryScore}/100, ${Math.round((completedThisWeek / Math.max(1, plannedThisWeek)) * 100)}% weekly adherence.`;

  const preview = computeWorkoutRecommendations(engineInput, new Map());
  const workoutsByDate = new Map<string, GeneratedWorkoutPlan | undefined>();

  async function attachWorkout(rec: typeof preview.today, date: string) {
    if (rec.isRestDay || rec.targetMuscles.length === 0) return;
    const plan = await buildAdaptiveWorkoutPlan(
      userId,
      rec.targetMuscles,
      `${rationaleBase} ${rec.whySelected[0] ?? rec.sessionLabel ?? 'Scheduled session'}.`,
    );
    workoutsByDate.set(date, plan);
  }

  if (intelligence.trainingRecommendation !== 'rest_day' || hasScheduledWorkoutToday) {
    await attachWorkout(preview.today, today);
    await attachWorkout(preview.tomorrow, addDays(today, 1));
  }

  return {
    assessedAt: new Date().toISOString(),
    ...computeWorkoutRecommendations(engineInput, workoutsByDate),
  };
}
