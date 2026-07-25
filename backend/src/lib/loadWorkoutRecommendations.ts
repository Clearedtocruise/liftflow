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

const CACHE_TTL_MS = 60 * 1000;

type RecommendationProfile = {
  fitness_goals?: string[] | null;
  primary_training_goal?: string | null;
  metadata?: Record<string, unknown> | null;
  timezone?: string | null;
};

type SessionSummaryRow = {
  started_at: string;
  workout_exercises?: Array<{
    exercises?: { muscle_groups?: string[] };
    workout_sets?: Array<{ weight: number | null; reps: number | null }>;
  }>;
};

type PlannedWorkoutRow = {
  id: string;
  name: string;
  scheduled_date: string;
  status: string;
  suggested_muscle_groups?: string[] | null;
};

type WorkoutRecommendationLoaderDeps = {
  now: () => Date;
  loadProfile: (userId: string) => Promise<RecommendationProfile>;
  loadRecoveryIntelligence: typeof loadRecoveryIntelligence;
  loadRecentSessions: (userId: string, sinceIso: string) => Promise<SessionSummaryRow[]>;
  loadPlannedWorkouts: (userId: string, weekStart: string, weekEnd: string) => Promise<PlannedWorkoutRow[]>;
  buildAdaptiveWorkoutPlan: typeof buildAdaptiveWorkoutPlan;
  computeWorkoutRecommendations: typeof computeWorkoutRecommendations;
  resolveRankedGoals: typeof resolveRankedGoals;
  inferDaysPerWeek: typeof inferDaysPerWeek;
  inferSplitFromProfile: typeof inferSplitFromProfile;
};

type WorkoutRecommendationCacheEntry = {
  expiresAt: number;
  value: WorkoutRecommendationReport;
};

const defaultDeps: WorkoutRecommendationLoaderDeps = {
  now: () => new Date(),
  async loadProfile(userId: string): Promise<RecommendationProfile> {
    const db = requireAdmin();
    const profileRes = await db
      .from('profiles')
      .select('fitness_goals, primary_training_goal, metadata, timezone')
      .eq('id', userId)
      .maybeSingle();

    return (profileRes.data ?? {}) as RecommendationProfile;
  },
  async loadRecentSessions(userId: string, sinceIso: string): Promise<SessionSummaryRow[]> {
    const db = requireAdmin();
    const sessionsRes = await db
      .from('workout_sessions')
      .select('started_at, workout_exercises(exercises(muscle_groups), workout_sets(weight, reps))')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('started_at', sinceIso);

    return (sessionsRes.data ?? []) as SessionSummaryRow[];
  },
  async loadPlannedWorkouts(userId: string, weekStart: string, weekEnd: string): Promise<PlannedWorkoutRow[]> {
    const db = requireAdmin();
    const plannedRes = await db
      .from('planned_workouts')
      .select('id, name, scheduled_date, status, suggested_muscle_groups')
      .eq('user_id', userId)
      .gte('scheduled_date', weekStart)
      .lte('scheduled_date', weekEnd);

    return (plannedRes.data ?? []) as PlannedWorkoutRow[];
  },
  loadRecoveryIntelligence,
  buildAdaptiveWorkoutPlan,
  computeWorkoutRecommendations,
  resolveRankedGoals,
  inferDaysPerWeek,
  inferSplitFromProfile,
};

function workoutRecommendationCacheKey(userId: string, today: string): string {
  return `${userId}:${today}`;
}

async function buildWorkoutRecommendationReport(
  userId: string,
  profile: RecommendationProfile,
  today: string,
  deps: WorkoutRecommendationLoaderDeps,
): Promise<WorkoutRecommendationReport> {
  const weekStartStr = weekStartDateString(today);
  const sevenDaysAgo = deps.now();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [intelligence, sessionsRows, plannedRows] = await Promise.all([
    deps.loadRecoveryIntelligence(userId, { profileTimeZone: profile.timezone ?? null }),
    deps.loadRecentSessions(userId, sevenDaysAgo.toISOString()),
    deps.loadPlannedWorkouts(userId, weekStartStr, addDays(today, 6)),
  ]);

  const ranked = deps.resolveRankedGoals(profile.fitness_goals, profile.primary_training_goal);
  const metadata = (profile.metadata ?? {}) as Record<string, unknown>;
  const sessions7d = sessionsRows.length;
  const daysPerWeek = deps.inferDaysPerWeek(metadata, sessions7d);
  const splitStyle = deps.inferSplitFromProfile(ranked, profile.primary_training_goal ?? undefined, daysPerWeek, metadata);

  const weeklyMuscleVolume = new Map<string, number>();
  for (const session of sessionsRows) {
    for (const we of session.workout_exercises ?? []) {
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

  const preview = deps.computeWorkoutRecommendations(engineInput, new Map());
  const workoutsByDate = new Map<string, GeneratedWorkoutPlan | undefined>();

  async function attachWorkout(rec: typeof preview.today, date: string) {
    if (rec.isRestDay || rec.targetMuscles.length === 0) return;
    const plan = await deps.buildAdaptiveWorkoutPlan(
      userId,
      rec.targetMuscles,
      `${rationaleBase} ${rec.whySelected[0] ?? rec.sessionLabel ?? 'Scheduled session'}.`,
    );
    workoutsByDate.set(date, plan);
  }

  if (intelligence.trainingRecommendation !== 'rest_day' || hasScheduledWorkoutToday) {
    await Promise.all([
      attachWorkout(preview.today, today),
      attachWorkout(preview.tomorrow, addDays(today, 1)),
    ]);
  }

  return {
    assessedAt: deps.now().toISOString(),
    ...deps.computeWorkoutRecommendations(engineInput, workoutsByDate),
  };
}

export function createWorkoutRecommendationLoader(
  overrides: Partial<WorkoutRecommendationLoaderDeps> = {},
  state?: {
    cache?: Map<string, WorkoutRecommendationCacheEntry>;
    inFlight?: Map<string, Promise<WorkoutRecommendationReport>>;
  },
): {
  loadWorkoutRecommendations: (userId: string) => Promise<WorkoutRecommendationReport>;
  invalidateWorkoutRecommendationsCache: (userId: string) => void;
} {
  const deps = { ...defaultDeps, ...overrides };
  const cache = state?.cache ?? new Map<string, WorkoutRecommendationCacheEntry>();
  const inFlight = state?.inFlight ?? new Map<string, Promise<WorkoutRecommendationReport>>();

  async function loadWorkoutRecommendations(userId: string): Promise<WorkoutRecommendationReport> {
    const shared = inFlight.get(userId);
    if (shared) return shared;

    const promise = (async () => {
      const profile = await deps.loadProfile(userId);
      const today = localDateString(deps.now(), profile.timezone ?? null);
      const cacheKey = workoutRecommendationCacheKey(userId, today);
      const cached = cache.get(cacheKey);
      const nowMs = deps.now().getTime();

      if (cached && cached.expiresAt > nowMs) {
        return cached.value;
      }
      if (cached) {
        cache.delete(cacheKey);
      }

      const report = await buildWorkoutRecommendationReport(userId, profile, today, deps);
      cache.set(cacheKey, {
        expiresAt: deps.now().getTime() + CACHE_TTL_MS,
        value: report,
      });
      return report;
    })();

    inFlight.set(userId, promise);
    try {
      return await promise;
    } finally {
      if (inFlight.get(userId) === promise) {
        inFlight.delete(userId);
      }
    }
  }

  function invalidateWorkoutRecommendationsCache(userId: string): void {
    inFlight.delete(userId);
    const prefix = `${userId}:`;
    for (const key of cache.keys()) {
      if (key.startsWith(prefix)) {
        cache.delete(key);
      }
    }
  }

  return {
    loadWorkoutRecommendations,
    invalidateWorkoutRecommendationsCache,
  };
}

const defaultWorkoutRecommendationLoader = createWorkoutRecommendationLoader();

export const loadWorkoutRecommendations = defaultWorkoutRecommendationLoader.loadWorkoutRecommendations;
export const invalidateWorkoutRecommendationsCache =
  defaultWorkoutRecommendationLoader.invalidateWorkoutRecommendationsCache;
