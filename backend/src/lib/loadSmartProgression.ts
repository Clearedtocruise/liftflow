import {
    computeSmartProgression,
    resolveGoalFocus,
    type ProgressionSessionHistory,
    type ProgressionSetRecord,
    type SmartProgressionRecommendation,
} from './smartProgressionEngine.js';
import { requireAdmin } from './supabase.js';
import { resolveWeightUnit } from './weightUnits.js';

type SetRow = {
  weight: number | null;
  reps: number | null;
  set_number: number | null;
  is_failure: boolean | null;
  logged_at: string;
  workout_exercises: {
    exercise_id: string;
    workout_sessions: { id: string; started_at: string; status: string };
    exercises: { name: string } | null;
  };
};

export async function loadSmartProgression(
  userId: string,
  exerciseId: string,
  options?: {
    sessionId?: string;
    currentSessionSets?: ProgressionSetRecord[];
  },
): Promise<SmartProgressionRecommendation> {
  const db = requireAdmin();

  const [profileRes, recoveryRes, setsRes, exerciseRes] = await Promise.all([
    db.from('profiles').select('fitness_goals, preferred_weight_unit, preferred_units').eq('id', userId).maybeSingle(),
    db
      .from('recovery_assessments')
      .select('recovery_score, metadata')
      .eq('user_id', userId)
      .order('check_in_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from('workout_sets')
      .select(
        'weight, reps, set_number, is_failure, logged_at, workout_exercises!inner(exercise_id, workout_sessions!inner(id, started_at, status, user_id), exercises(name))',
      )
      .eq('workout_exercises.exercise_id', exerciseId)
      .eq('workout_exercises.workout_sessions.user_id', userId)
      .eq('workout_exercises.workout_sessions.status', 'completed')
      .order('logged_at', { ascending: false })
      .limit(200),
    db.from('exercises').select('name').eq('id', exerciseId).maybeSingle(),
  ]);

  const exerciseName = exerciseRes.data?.name ?? 'Exercise';
  const goalFocus = resolveGoalFocus(profileRes.data?.fitness_goals as string[] | undefined);
  const weightUnit = resolveWeightUnit(profileRes.data);
  const recoveryScore = recoveryRes.data?.recovery_score ?? 72;
  const recoveryVolumeMultiplier =
    (recoveryRes.data?.metadata as { volumeMultiplier?: number } | null)?.volumeMultiplier ?? 1;

  const bySession = new Map<string, ProgressionSessionHistory>();
  for (const row of (setsRes.data ?? []) as unknown as SetRow[]) {
    const session = row.workout_exercises.workout_sessions;
    if (options?.sessionId && session.id === options.sessionId) continue;

    const existing = bySession.get(session.id);
    const set: ProgressionSetRecord = {
      weightKg: Number(row.weight ?? 0),
      reps: Number(row.reps ?? 0),
      setNumber: row.set_number ?? undefined,
      isFailure: row.is_failure ?? false,
    };

    if (!existing) {
      bySession.set(session.id, {
        sessionId: session.id,
        sessionDate: session.started_at.slice(0, 10),
        sets: [set],
        totalVolume: set.weightKg * set.reps,
      });
    } else {
      existing.sets.push(set);
      existing.totalVolume += set.weightKg * set.reps;
    }
  }

  const priorSessions = [...bySession.values()]
    .map((s) => ({
      ...s,
      sets: s.sets.sort((a, b) => (a.setNumber ?? 0) - (b.setNumber ?? 0)),
    }))
    .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))
    .slice(0, 8);

  return computeSmartProgression({
    exerciseName,
    exerciseId,
    priorSessions,
    currentSessionSets: options?.currentSessionSets ?? [],
    goalFocus,
    recoveryScore,
    recoveryVolumeMultiplier,
    weightUnit,
  });
}
