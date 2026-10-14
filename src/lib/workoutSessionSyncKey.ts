import type { WorkoutSession } from '@/types';

/**
 * Whether a freshly fetched session is actually different from the one on screen.
 *
 * The workout screen refetches while a session is open. Replacing state with an equal session
 * still yields a new object, and several effects treat that as "the workout changed" — which
 * re-fetches again. Logging a set, editing one, or reordering a lift changes this key; a refetch
 * that came back identical does not.
 *
 * Which lift an entry points at is part of the key, not just the entry's own id. Swapping an
 * exercise that has no sets yet rewrites `exercise_id` in place, keeping the row id, the sort
 * order and the (empty) set list — so a key built from those alone cannot tell the swap happened,
 * and the screen goes on showing the lift the user just replaced until a logged set finally moves
 * the key.
 */
export function workoutSessionSyncKey(session: WorkoutSession): string {
  const exercises = [...session.exercises].sort((a, b) => a.sortOrder - b.sortOrder);
  const body = exercises
    .map((exercise) => {
      const sets = [...exercise.sets]
        .sort((a, b) => a.setNumber - b.setNumber)
        .map(
          (set) =>
            `${set.id}:${set.weight ?? ''}:${set.reps ?? ''}:${set.durationSeconds ?? ''}:${set.isPr ? 1 : 0}`,
        )
        .join(',');
      return `${exercise.id}@${exercise.sortOrder}=${exercise.exerciseId}~${exercise.suggestedWeight ?? ''}#${sets}`;
    })
    .join('|');

  return `${session.id}:${session.status}:${body}`;
}
