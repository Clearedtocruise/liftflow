import type { PlannedWorkout } from '@/types/training';

/**
 * Sync bridge for weekly-plan → day navigation.
 * Context updates can lag one frame behind expo-router pushes; this keeps the
 * tapped workout available even if params/draft are briefly empty.
 */
let handoff: PlannedWorkout | null = null;

export function setPlannedWorkoutHandoff(workout: PlannedWorkout | null): void {
  handoff = workout && workout.status !== 'cancelled' ? workout : null;
}

export function peekPlannedWorkoutHandoff(): PlannedWorkout | null {
  return handoff;
}

export function takePlannedWorkoutHandoff(match?: {
  id?: string;
  date?: string;
}): PlannedWorkout | null {
  if (!handoff) return null;
  if (match?.id && handoff.id !== match.id) return null;
  if (match?.date && handoff.scheduledDate !== match.date) return null;
  const next = handoff;
  handoff = null;
  return next;
}
