/**
 * How long after finishing a workout the "continue workout" undo stays available. Long
 * enough to cover an accidental "Finish Workout" tap (the reported bug — a mis-tap that
 * ends the session before the last exercises are logged), short enough that reopening
 * doesn't quietly rewrite a workout from days ago and confuse streaks/history.
 */
export const SESSION_REOPEN_GRACE_MS = 3 * 60 * 60 * 1000;

export function canReopenSession(session: { status: string; endedAt?: string | null }): boolean {
  if (session.status !== 'completed') return false;
  if (!session.endedAt) return true;

  const endedMs = new Date(session.endedAt).getTime();
  if (Number.isNaN(endedMs)) return true;

  return Date.now() - endedMs <= SESSION_REOPEN_GRACE_MS;
}
