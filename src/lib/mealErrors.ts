/**
 * Turning meal write failures into something a lifter can act on.
 *
 * Updating a meal by id used to end in `.single()`, which PostgREST rejects with "Cannot coerce
 * the result to a single JSON object" when the update matches no rows. That happens whenever the
 * on-screen meal has since been replaced server-side — day sync and duplicate pruning both delete
 * and reinsert plan rows — so the id in hand is stale. The raw database wording went straight to
 * an alert.
 */

/** Returned when a meal write matched no row, so the caller can refresh instead of retrying. */
export const MEAL_NOT_FOUND = 'MEAL_NOT_FOUND';

const POSTGREST_NO_SINGLE_ROW = /cannot coerce the result to a single json object/i;
/** PostgREST's code for the same condition. */
const PGRST_NO_ROWS = 'PGRST116';

export function isStaleMealError(result: { error?: string; code?: string }): boolean {
  if (result.code === MEAL_NOT_FOUND || result.code === PGRST_NO_ROWS) return true;
  return POSTGREST_NO_SINGLE_ROW.test(result.error ?? '');
}

export function friendlyMealError(raw: string, code?: string): string {
  if (isStaleMealError({ error: raw, code })) {
    return 'That meal was updated somewhere else. Refreshing your plan — try again.';
  }
  if (/network|fetch|timeout|timed out/i.test(raw)) {
    return "We couldn't reach your meal plan. Check your connection and try again.";
  }
  if (/^API error|\b(4\d\d|5\d\d)\b/.test(raw)) {
    return 'Something went wrong on our end. Please try again in a moment.';
  }
  // Database and PostgREST wording is never worth showing verbatim.
  if (/\b(json|postgres|pgrst|constraint|relation|column|coerce)\b/i.test(raw)) {
    return 'Could not save that change. Please try again.';
  }
  return raw;
}
