import { loadHealthContext } from './loadHealthContext.js';
import { localDateString } from './localDate.js';
import {
    computeRecoveryIntelligence,
    countConsecutiveTrainingDays,
    type RecoveryIntelligenceReport,
    type SessionMuscleLoad,
} from './recoveryIntelligenceEngine.js';
import { requireAdmin } from './supabase.js';

type SessionRow = {
  id: string;
  started_at: string;
  duration_seconds: number | null;
  total_volume: number | null;
  workout_exercises?: Array<{
    id: string;
    workout_sets?: Array<{ weight: number | null; reps: number | null }>;
    exercises?: { muscle_groups?: string[] | null } | null;
  }>;
};

function mapSessionToLoad(row: SessionRow): SessionMuscleLoad {
  const muscleGroups = new Set<string>();
  const setsByMuscle: Record<string, number> = {};
  const volumeByMuscle: Record<string, number> = {};

  for (const we of row.workout_exercises ?? []) {
    const groups = we.exercises?.muscle_groups ?? [];
    for (const mg of groups) {
      muscleGroups.add(mg);
    }
    for (const set of we.workout_sets ?? []) {
      const w = Number(set.weight ?? 0);
      const r = Number(set.reps ?? 0);
      const vol = w * r;
      for (const mg of groups) {
        setsByMuscle[mg] = (setsByMuscle[mg] ?? 0) + 1;
        volumeByMuscle[mg] = (volumeByMuscle[mg] ?? 0) + vol;
      }
    }
  }

  return {
    sessionId: row.id,
    startedAt: row.started_at,
    durationSeconds: row.duration_seconds ?? 0,
    totalVolume: Number(row.total_volume ?? 0),
    muscleGroups: [...muscleGroups],
    setsByMuscle,
    volumeByMuscle,
  };
}

export async function loadRecoveryIntelligence(userId: string): Promise<RecoveryIntelligenceReport> {
  const db = requireAdmin();
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const threeDaysAgo = new Date(now);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const { data: profile } = await db.from('profiles').select('timezone').eq('id', userId).maybeSingle();
  const today = localDateString(now, profile?.timezone as string | null | undefined);

  const [checkInRes, trendRes, sessionsRes, cardioRes, healthContext] = await Promise.all([
    db
      .from('recovery_assessments')
      .select(
        'sleep_hours, sleep_quality_score, energy_score, stress_score, soreness_score, recovery_score, recovery_mode_active',
      )
      .eq('user_id', userId)
      .eq('check_in_date', today)
      .maybeSingle(),
    db
      .from('recovery_assessments')
      .select('check_in_date, recovery_score')
      .eq('user_id', userId)
      .not('check_in_date', 'is', null)
      .gte('check_in_date', fourteenDaysAgo.toISOString().slice(0, 10))
      .order('check_in_date', { ascending: true }),
    db
      .from('workout_sessions')
      .select(
        `id, started_at, duration_seconds, total_volume,
         workout_exercises (
           id,
           exercises (muscle_groups),
           workout_sets (weight, reps)
         )`,
      )
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('started_at', sevenDaysAgo.toISOString())
      .order('started_at', { ascending: false }),
    db
      .from('cardio_sessions')
      .select('id, started_at, duration_seconds, metadata, cardio_type')
      .eq('user_id', userId)
      .gte('started_at', sevenDaysAgo.toISOString())
      .order('started_at', { ascending: false }),
    loadHealthContext(userId),
  ]);

  const sessions7d = ((sessionsRes.data ?? []) as SessionRow[]).map(mapSessionToLoad);
  const cardioLoads: SessionMuscleLoad[] = (cardioRes.data ?? []).map(
    (row: { id: string; started_at: string; duration_seconds: number | null; metadata?: Record<string, unknown> | null }) => {
      const duration = row.duration_seconds ?? 0;
      const intensity = row.metadata?.intensity === 'high' ? 1.4 : row.metadata?.intensity === 'low' ? 0.7 : 1;
      const syntheticVolume = Math.round(duration * 8 * intensity);
      return {
        sessionId: row.id,
        startedAt: row.started_at,
        durationSeconds: duration,
        totalVolume: syntheticVolume,
        muscleGroups: ['legs'],
        setsByMuscle: { legs: 1 },
        volumeByMuscle: { legs: syntheticVolume },
      };
    },
  );
  const allSessions7d = [...sessions7d, ...cardioLoads].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
  const sessions3d = allSessions7d.filter((s) => new Date(s.startedAt) >= threeDaysAgo);
  const consecutiveTrainingDays = countConsecutiveTrainingDays(
    (sessionsRes.data ?? []).map((s: { started_at: string }) => s.started_at),
  );

  const checkIn = checkInRes.data;
  const trendScores = (trendRes.data ?? []).map((row: { check_in_date: string; recovery_score: number | null }) => ({
    date: row.check_in_date,
    score: row.recovery_score ?? 0,
  }));
  const sleepFromHealth = healthContext.latestSleepHours;
  const checkInSleep = checkIn?.sleep_hours ?? undefined;
  const sleepSource =
    checkInSleep != null ? ('check_in' as const) : sleepFromHealth != null ? ('health_kit' as const) : undefined;

  return computeRecoveryIntelligence({
    checkIn: checkIn || sleepFromHealth != null
      ? {
          sleepHours: checkInSleep ?? sleepFromHealth,
          sleepQuality: checkIn?.sleep_quality_score ?? undefined,
          energyLevel: checkIn?.energy_score ?? undefined,
          stressLevel: checkIn?.stress_score ?? undefined,
          sorenessLevel: checkIn?.soreness_score ?? undefined,
          recoveryScore: checkIn?.recovery_score ?? undefined,
          recoveryModeActive: checkIn?.recovery_mode_active ?? undefined,
        }
      : undefined,
    inputSources: sleepSource ? { sleepHours: sleepSource } : undefined,
    sessions7d: allSessions7d,
    sessions3d,
    consecutiveTrainingDays,
    trendScores,
    sleepDataAvailable: healthContext.sleepDataAvailable,
    healthKitAvailable: healthContext.healthKitAvailable,
  });
}
