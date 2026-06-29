import type { PendingSetRecord } from '@/lib/pendingSetQueue';
import type { CreateSetPayload, WorkoutSession, WorkoutSet } from '@/types';

export function buildPendingWorkoutSet(
  payload: CreateSetPayload,
  pendingId: string,
  setNumber: number,
): WorkoutSet {
  return {
    id: `pending-${pendingId}`,
    workoutExerciseId: payload.workoutExerciseId,
    setNumber,
    weight: payload.weight,
    reps: payload.reps,
    type: payload.type ?? 'normal',
    durationSeconds: payload.durationSeconds,
    distanceMeters: payload.distanceMeters,
    loggedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    pendingSync: true,
  };
}

export function applyOptimisticSetToSession(
  session: WorkoutSession,
  payload: CreateSetPayload,
  pendingId: string,
): { session: WorkoutSession; set: WorkoutSet } {
  let created: WorkoutSet | null = null;
  const exercises = session.exercises.map((exercise) => {
    if (exercise.id !== payload.workoutExerciseId) return exercise;
    const setNumber = exercise.sets.length + 1;
    created = buildPendingWorkoutSet(payload, pendingId, setNumber);
    return { ...exercise, sets: [...exercise.sets, created] };
  });
  if (!created) throw new Error('Exercise not found for optimistic set');
  return { session: { ...session, exercises }, set: created };
}

/** Re-attach queued sets after a server refresh so offline logs stay visible until sync. */
export function mergePendingSetsIntoSession(
  session: WorkoutSession,
  pending: PendingSetRecord[],
): WorkoutSession {
  let merged = session;
  for (const item of pending) {
    if (item.sessionId !== session.id) continue;
    const pendingSetId = `pending-${item.id}`;
    const exercise = merged.exercises.find((row) => row.id === item.payload.workoutExerciseId);
    if (!exercise || exercise.sets.some((set) => set.id === pendingSetId)) continue;
    merged = applyOptimisticSetToSession(merged, item.payload, item.id).session;
  }
  return merged;
}

export function clearLocalRestTimerState(setters: {
  setActiveRestPeriod: (value: null) => void;
  setRestSecondsRemaining: (value: null) => void;
  setRestTimerPaused: (value: false) => void;
  restEndAtRef: { current: number | null };
  pausedRemainingRef: { current: number | null };
}): void {
  setters.setActiveRestPeriod(null);
  setters.setRestSecondsRemaining(null);
  setters.setRestTimerPaused(false);
  setters.restEndAtRef.current = null;
  setters.pausedRemainingRef.current = null;
}
