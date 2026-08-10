import { localDateString } from '../localDate.js';
import { addDays, weekStartFromDate } from '../programTypes.js';

/** Local Mon–Sun window the Workout/Nutrition tabs query for an athlete. */
export function cutPlanWeekWindow(
  now: Date = new Date(),
  timeZone?: string | null,
): { today: string; weekStart: string; weekEnd: string } {
  const today = localDateString(now, timeZone);
  const weekStart = weekStartFromDate(today);
  return { today, weekStart, weekEnd: addDays(weekStart, 6) };
}
