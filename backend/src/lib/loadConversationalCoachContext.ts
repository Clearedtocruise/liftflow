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

/** Caps exist so the snapshot cannot grow past `asPromptData`'s truncation limit and lose its tail. */
const MAX_RECENT_WORKOUTS = 5;
const MAX_RECENT_SETS = 5;
const MAX_RECOVERY_TREND_POINTS = 8;
const MAX_MEMORY_TURNS = 4;

/**
 * The only view of the user the model ever gets, so anything omitted here is invisible to it no
 * matter how much of it the loaders fetched. Ordered most- to least-decision-relevant because
 * `asPromptData` truncates the tail rather than the head.
 */
export function buildContextSnapshot(ctx: ConversationalCoachContext) {
  const coach = ctx.coachContext;
  const tip = ctx.nutrition.coachingTips[0];
  const score = ctx.outcome.successScore;
  const nutritionCtx = ctx.nutrition.context;
  const lastPerf = coach.lastPerformance[0];

  return {
    asOfDate: coach.today,
    weightUnit: coach.weightUnit,
    goals: ctx.goals,
    /** Injuries and pain flags gate exercise selection, so the model must see them every turn. */
    limitations: coach.limitations.map((limitation) => ({
      bodyArea: limitation.bodyArea,
      limitationType: limitation.limitationType,
      painScore: limitation.painScore,
      affectedMovements: limitation.affectedMovements,
    })),
    workoutHistory: {
      sessionsLast7d: ctx.recovery.factors.workoutsLast7d,
      totalVolume7d: nutritionCtx.trainingVolume7d,
      volumeBaseline7d: nutritionCtx.trainingVolumeBaseline7d,
      consecutiveTrainingDays: ctx.recovery.factors.consecutiveTrainingDays,
      lastExercise: lastPerf?.exercise,
      lastWeight: lastPerf?.weight,
      lastReps: lastPerf?.reps,
      recentSessions: coach.recentWorkouts.slice(0, MAX_RECENT_WORKOUTS).map((workout) => ({
        name: workout.name,
        date: workout.date.slice(0, 10),
        volume: workout.volume,
        sets: workout.sets,
      })),
      recentSets: coach.lastPerformance.slice(0, MAX_RECENT_SETS).map((set) => ({
        exercise: set.exercise,
        weight: set.weight,
        reps: set.reps,
        date: set.date.slice(0, 10),
      })),
    },
    /** Direction over 4 weeks; without this the model cannot tell a plateau from a single bad set. */
    strengthTrend: {
      exercises: coach.strengthTrend.entries.map((entry) => ({
        exercise: entry.exercise,
        sessions: entry.sessions,
        daysCovered: entry.daysCovered,
        from: `${entry.firstTopSet.weight}x${entry.firstTopSet.reps}`,
        to: `${entry.lastTopSet.weight}x${entry.lastTopSet.reps}`,
        deltaEstimated1rm: entry.deltaEstimated1rm,
        direction: entry.direction,
      })),
      stalledExercises: coach.strengthTrend.stalledExercises,
    },
    recovery: {
      score: ctx.recovery.recoveryScore,
      status: ctx.recovery.recoveryStatus,
      trainingRecommendation: ctx.recovery.trainingRecommendation,
      suggestedMuscles: ctx.recovery.suggestedMuscleGroups,
      avoidMuscles: ctx.recovery.avoidMuscleGroups,
      sleepHours: ctx.recovery.factors.sleepHours,
      sorenessLevel: ctx.recovery.factors.sorenessLevel,
      recentScores: ctx.recovery.trend
        .slice(-MAX_RECOVERY_TREND_POINTS)
        .map((point) => ({ date: point.date, score: point.score })),
    },
    nutrition: {
      caloriesTarget: ctx.nutrition.macroTargets.calories,
      proteinTargetG: ctx.nutrition.macroTargets.proteinG,
      caloriesTodayG: nutritionCtx.caloriesConsumedToday,
      proteinTodayG: ctx.nutrition.intakeToday.proteinG,
      caloriesRemaining: ctx.nutrition.gapAnalysis.caloriesRemaining,
      proteinRemainingG: ctx.nutrition.gapAnalysis.proteinRemainingG,
      loggingAdherencePct: nutritionCtx.adherencePct,
      loggedDaysLast7d: nutritionCtx.nutritionLogDays7d,
      targetRationale: ctx.nutrition.macroTargets.rationale,
      topCoachingTip: tip?.message,
    },
    bodyWeight: {
      currentKg: nutritionCtx.currentWeightKg,
      trend: nutritionCtx.weightTrend,
      deltaKg14d: nutritionCtx.weightDeltaKg,
    },
    workoutToday: {
      sessionLabel: ctx.workoutRecommendation.today.sessionLabel ?? ctx.workoutRecommendation.today.workout?.name,
      isRestDay: ctx.workoutRecommendation.today.isRestDay,
      targetMuscles: ctx.workoutRecommendation.today.targetMuscles,
      whySelected: ctx.workoutRecommendation.today.whySelected.slice(0, 2),
      adherencePct: ctx.workoutRecommendation.context.adherencePct,
    },
    program: coach.program,
    outcome: {
      successScore: score?.overall_score != null ? Number(score.overall_score) : undefined,
      scoreCategory: score?.score_category ?? undefined,
      lifeImproved: score?.life_improved ?? undefined,
      riskFlags: (ctx.outcome.activeRiskFlags ?? []).map((flag) => flag.flag_type),
      activeGoalCount: ctx.outcome.activeGoals?.length ?? 0,
    },
    progressPhotos: {
      totalCount: ctx.progressPhotos.totalCount,
      latestDate: ctx.progressPhotos.latestDate,
      latestAngle: ctx.progressPhotos.latestAngle,
    },
    memory: {
      summary: ctx.memory.summary,
      lastTopic: ctx.memory.lastTopic,
      recentTurns: ctx.memory.recentTurns.slice(0, MAX_MEMORY_TURNS).map((turn) => ({
        message: turn.message,
        shortAnswer: turn.shortAnswer,
        createdAt: turn.createdAt.slice(0, 10),
      })),
    },
  };
}
