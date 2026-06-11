import { supabase } from '@/supabase/client';
import type { ExerciseMetric } from '@/types/exerciseCard';

export type ExerciseSessionSummary = {
  sessionId: string;
  date: string;
  reps: number[];
  setCount: number;
  topReps: number;
  topWeightKg?: number;
  volumeKg: number;
  totalReps: number;
};

export type ExerciseStats = {
  hasData: boolean;
  exerciseId?: string;
  totalSessions: number;

  personalBestReps?: number;
  personalBestWeightKg?: number;
  bestSetVolumeKg?: number;
  mostSetsInSession?: number;

  lastSession?: ExerciseSessionSummary;
  recentSessions: ExerciseSessionSummary[];

  monthlyVolumeKg: number;
  lifetimeVolumeKg: number;
  monthlyReps: number;
  lifetimeReps: number;

  currentTopReps?: number;
  currentTopWeightKg?: number;

  /** % change in best estimated 1RM (or top reps for bodyweight) over 30 days. */
  improvementPct30d?: number;
  /** Typical rep number where sets bottom out — the lifter's sticking point. */
  stickingPointRep?: number;
};

const EMPTY: ExerciseStats = {
  hasData: false,
  totalSessions: 0,
  recentSessions: [],
  monthlyVolumeKg: 0,
  lifetimeVolumeKg: 0,
  monthlyReps: 0,
  lifetimeReps: 0,
};

type SetRow = {
  weight: number | null;
  reps: number | null;
  set_number: number | null;
  logged_at: string;
  workout_exercises: {
    session_id: string;
    workout_sessions: { started_at: string | null; ended_at: string | null } | null;
  } | null;
};

/** Resolve a Supabase exercise id from a slug or display name. */
export async function findExerciseId(opts: { slug?: string; name?: string }): Promise<string | null> {
  const { slug, name } = opts;
  if (slug) {
    const { data } = await supabase.from('exercises').select('id').eq('slug', slug).limit(1).maybeSingle();
    if (data?.id) return data.id;
  }
  if (name) {
    const { data } = await supabase.from('exercises').select('id').ilike('name', name).limit(1).maybeSingle();
    if (data?.id) return data.id;
  }
  return null;
}

function e1rm(weightKg: number, reps: number): number {
  if (weightKg <= 0) return reps;
  return weightKg * (1 + reps / 30);
}

export async function getExerciseStats(
  userId: string,
  opts: { exerciseId?: string; slug?: string; name?: string; metric?: ExerciseMetric },
): Promise<ExerciseStats> {
  const exerciseId = opts.exerciseId ?? (await findExerciseId({ slug: opts.slug, name: opts.name }));
  if (!exerciseId) return EMPTY;

  const { data, error } = await supabase
    .from('workout_sets')
    .select(
      'weight, reps, set_number, logged_at, workout_exercises!inner(session_id, exercise_id, workout_sessions!inner(user_id, status, started_at, ended_at))',
    )
    .eq('workout_exercises.exercise_id', exerciseId)
    .eq('workout_exercises.workout_sessions.user_id', userId)
    .eq('workout_exercises.workout_sessions.status', 'completed')
    .order('logged_at', { ascending: false })
    .limit(600);

  if (error || !data || data.length === 0) {
    return { ...EMPTY, exerciseId };
  }

  const rows = data as unknown as SetRow[];
  const isWeighted = opts.metric !== 'reps' && opts.metric !== 'time';

  const bySession = new Map<string, ExerciseSessionSummary>();
  let personalBestReps = 0;
  let personalBestWeightKg = 0;
  let bestSetVolumeKg = 0;
  let lifetimeVolumeKg = 0;
  let lifetimeReps = 0;

  for (const row of rows) {
    const reps = row.reps ?? 0;
    const weight = row.weight ?? 0;
    const sessionId = row.workout_exercises?.session_id ?? 'unknown';
    const date = row.workout_exercises?.workout_sessions?.started_at ?? row.logged_at;

    const setVolume = weight * reps;
    lifetimeVolumeKg += setVolume;
    lifetimeReps += reps;
    if (reps > personalBestReps) personalBestReps = reps;
    if (weight > personalBestWeightKg) personalBestWeightKg = weight;
    if (setVolume > bestSetVolumeKg) bestSetVolumeKg = setVolume;

    let summary = bySession.get(sessionId);
    if (!summary) {
      summary = {
        sessionId,
        date,
        reps: [],
        setCount: 0,
        topReps: 0,
        topWeightKg: undefined,
        volumeKg: 0,
        totalReps: 0,
      };
      bySession.set(sessionId, summary);
    }
    summary.reps.push(reps);
    summary.setCount += 1;
    summary.totalReps += reps;
    summary.volumeKg += setVolume;
    if (reps > summary.topReps) summary.topReps = reps;
    if (weight > (summary.topWeightKg ?? 0)) summary.topWeightKg = weight;
  }

  const sessions = Array.from(bySession.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  // Sets came newest-first; restore chronological order within each session.
  for (const s of sessions) s.reps.reverse();

  const now = Date.now();
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
  let monthlyVolumeKg = 0;
  let monthlyReps = 0;
  for (const row of rows) {
    const date = row.workout_exercises?.workout_sessions?.started_at ?? row.logged_at;
    if (new Date(date).getTime() >= monthAgo) {
      monthlyVolumeKg += (row.weight ?? 0) * (row.reps ?? 0);
      monthlyReps += row.reps ?? 0;
    }
  }

  const mostSetsInSession = sessions.reduce((max, s) => Math.max(max, s.setCount), 0);
  const lastSession = sessions[0];
  const recentSessions = sessions.slice(0, 8).reverse();

  // Improvement: best e1RM (or top reps) in last 30d vs the prior window.
  let recentBest = 0;
  let priorBest = 0;
  for (const s of sessions) {
    const score = isWeighted ? e1rm(s.topWeightKg ?? 0, s.topReps) : s.topReps;
    if (new Date(s.date).getTime() >= monthAgo) recentBest = Math.max(recentBest, score);
    else priorBest = Math.max(priorBest, score);
  }
  const improvementPct30d = priorBest > 0 ? Math.round(((recentBest - priorBest) / priorBest) * 100) : undefined;

  // Sticking point: average of each session's lowest working-set reps.
  const minReps = sessions
    .filter((s) => s.reps.length > 0)
    .map((s) => Math.min(...s.reps.filter((r) => r > 0)))
    .filter((n) => Number.isFinite(n));
  const stickingPointRep = minReps.length
    ? Math.round(minReps.reduce((a, b) => a + b, 0) / minReps.length)
    : undefined;

  return {
    hasData: true,
    exerciseId,
    totalSessions: sessions.length,
    personalBestReps: personalBestReps || undefined,
    personalBestWeightKg: personalBestWeightKg || undefined,
    bestSetVolumeKg: bestSetVolumeKg || undefined,
    mostSetsInSession: mostSetsInSession || undefined,
    lastSession,
    recentSessions,
    monthlyVolumeKg,
    lifetimeVolumeKg,
    monthlyReps,
    lifetimeReps,
    currentTopReps: lastSession?.topReps,
    currentTopWeightKg: lastSession?.topWeightKg,
    improvementPct30d,
    stickingPointRep,
  };
}
