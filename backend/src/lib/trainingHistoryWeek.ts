/**
 * Which week of training an athlete is in, counted from what they have actually done.
 *
 * This used to be calendar arithmetic against the program record's start date, which was wrong in
 * two directions. It restarted at Week 1 whenever the program record was replaced — importing a
 * plan, loading a preset, a regeneration that lost the original start date — so someone months in
 * was told they were in Week 1. And it advanced through weeks nobody trained, so a fortnight away
 * came back as Week 3 of a block with two weeks of work in it.
 *
 * Counting the distinct weeks a session was completed in survives a new program record and does
 * not credit time off. Weeks run Monday to Sunday, matching the rest of the planner.
 */

import { weekStartFromDate } from './programTypes.js';
import { requireAdmin } from './supabase.js';

type Db = ReturnType<typeof requireAdmin>;

/**
 * Enough history for well over a decade of daily training. The count only needs the distinct weeks,
 * so the cap exists to bound the read rather than to bound the answer.
 */
const MAX_SESSIONS_READ = 5_000;

/**
 * One more than the number of earlier weeks the athlete completed a session in.
 *
 * The current week is counted as begun rather than finished: someone training for the first time
 * today is in Week 1, and someone who trained last week is in Week 2 whether or not they have
 * lifted yet this week. That keeps the number steady across a week instead of jumping the moment
 * the first set is logged.
 */
export function trainingWeekFromSessionDates(sessionDates: Iterable<string>, today: string): number {
  const currentWeekStart = weekStartFromDate(today);
  const earlierWeeks = new Set<string>();

  for (const date of sessionDates) {
    const day = date?.slice(0, 10);
    if (!day || Number.isNaN(Date.parse(day))) continue;
    const weekStart = weekStartFromDate(day);
    // ISO dates compare correctly as strings.
    if (weekStart < currentWeekStart) earlierWeeks.add(weekStart);
  }

  return earlierWeeks.size + 1;
}

/** {@link trainingWeekFromSessionDates} over the athlete's completed sessions. */
export async function loadTrainingWeek(
  db: Db,
  userId: string,
  today = new Date().toISOString().slice(0, 10),
): Promise<number> {
  const { data } = await db
    .from('workout_sessions')
    .select('started_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('started_at', { ascending: true })
    .limit(MAX_SESSIONS_READ);

  return trainingWeekFromSessionDates(
    (data ?? []).map((row) => String((row as { started_at?: string }).started_at ?? '')),
    today,
  );
}
