import { loadCoachContext } from './coachContext.js';
import { loadCoachMemory, type CoachMemoryState } from './coachMemory.js';
import { loadNutritionIntelligence } from './loadNutritionIntelligence.js';
import { loadRecoveryIntelligence } from './loadRecoveryIntelligence.js';
import { loadWorkoutRecommendations } from './loadWorkoutRecommendations.js';
import { getUserOutcomeSummary } from './outcomeEngine.js';
import { requireAdmin } from './supabase.js';
import { resolveRankedGoals } from './trainingGoals.js';

export type ConversationalCoachContext = {
  userId: string;
  loadedAt: string;
  goals: { primary: string; ranked: string[] };
  coachContext: Awaited<ReturnType<typeof loadCoachContext>>;
  recovery: Awaited<ReturnType<typeof loadRecoveryIntelligence>>;
  workoutRecommendation: Awaited<ReturnType<typeof loadWorkoutRecommendations>>;
  nutrition: Awaited<ReturnType<typeof loadNutritionIntelligence>>;
  outcome: Awaited<ReturnType<typeof getUserOutcomeSummary>>;
  progressPhotos: {
    totalCount: number;
    latestDate?: string;
    latestAngle?: string;
    recentAngles: string[];
  };
  memory: CoachMemoryState;
};

export async function loadConversationalCoachContext(userId: string): Promise<ConversationalCoachContext> {
  const db = requireAdmin();

  const [coachContext, recovery, workoutRecommendation, nutrition, outcome, photosRes, photoCountRes, profileRes, memory] =
    await Promise.all([
      loadCoachContext(userId),
      loadRecoveryIntelligence(userId),
      loadWorkoutRecommendations(userId),
      loadNutritionIntelligence(userId),
      getUserOutcomeSummary(userId),
      db
        .from('progress_photos')
        .select('taken_at, angle')
        .eq('user_id', userId)
        .order('taken_at', { ascending: false })
        .limit(5),
      db.from('progress_photos').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      db.from('profiles').select('fitness_goals, primary_training_goal').eq('id', userId).maybeSingle(),
      loadCoachMemory(userId),
    ]);

  const ranked = resolveRankedGoals(profileRes.data?.fitness_goals, profileRes.data?.primary_training_goal);
  const photos = photosRes.data ?? [];

  return {
    userId,
    loadedAt: new Date().toISOString(),
    goals: { primary: ranked[0] ?? 'general_fitness', ranked },
    coachContext,
    recovery,
    workoutRecommendation,
    nutrition,
    outcome,
    progressPhotos: {
      totalCount: photoCountRes.count ?? photos.length,
      latestDate: photos[0]?.taken_at?.slice(0, 10),
      latestAngle: photos[0]?.angle ?? undefined,
      recentAngles: photos.map((p) => p.angle).filter(Boolean) as string[],
    },
    memory,
  };
}

export function buildContextSnapshot(ctx: ConversationalCoachContext) {
  const lastPerf = ctx.coachContext.lastPerformance[0];
  const tip = ctx.nutrition.coachingTips[0];
  const score = ctx.outcome.successScore;

  return {
    goals: ctx.goals,
    workoutHistory: {
      sessionsLast7d: ctx.recovery.factors.workoutsLast7d,
      totalVolume7d: ctx.nutrition.context.trainingVolume7d,
      lastExercise: lastPerf?.exercise,
      lastWeight: lastPerf?.weight,
      lastReps: lastPerf?.reps,
    },
    recovery: {
      score: ctx.recovery.recoveryScore,
      status: ctx.recovery.recoveryStatus,
      trainingRecommendation: ctx.recovery.trainingRecommendation,
      suggestedMuscles: ctx.recovery.suggestedMuscleGroups,
    },
    nutrition: {
      caloriesTarget: ctx.nutrition.macroTargets.calories,
      proteinTargetG: ctx.nutrition.macroTargets.proteinG,
      proteinTodayG: ctx.nutrition.intakeToday.proteinG,
      topCoachingTip: tip?.message,
    },
    workoutToday: {
      sessionLabel: ctx.workoutRecommendation.today.sessionLabel ?? ctx.workoutRecommendation.today.workout?.name,
      isRestDay: ctx.workoutRecommendation.today.isRestDay,
      targetMuscles: ctx.workoutRecommendation.today.targetMuscles,
    },
    outcome: {
      successScore: score?.overall_score != null ? Number(score.overall_score) : undefined,
      scoreCategory: score?.score_category ?? undefined,
      lifeImproved: score?.life_improved ?? undefined,
      riskFlagCount: ctx.outcome.activeRiskFlags?.length ?? 0,
      activeGoalCount: ctx.outcome.activeGoals?.length ?? 0,
    },
    progressPhotos: {
      totalCount: ctx.progressPhotos.totalCount,
      latestDate: ctx.progressPhotos.latestDate,
      latestAngle: ctx.progressPhotos.latestAngle,
    },
    memory: ctx.memory,
  };
}
