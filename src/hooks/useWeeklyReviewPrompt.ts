import { useMemo } from 'react';

import { localDateString } from '@/lib/localDate';
import { getWeekRange } from '@/lib/weekPlan';

/** Saturday evening (5 PM+) in user's timezone triggers weekly review prompt. */
export function isWeeklyReviewWindow(reference = new Date(), timeZone?: string | null): boolean {
  const today = localDateString(reference, timeZone);
  const { dates } = getWeekRange(reference, timeZone);
  const saturday = dates[5];
  if (today !== saturday) return false;

  try {
    const hour = Number(
      new Intl.DateTimeFormat('en-US', { timeZone: timeZone ?? undefined, hour: 'numeric', hour12: false }).format(
        reference,
      ),
    );
    return hour >= 17;
  } catch {
    return reference.getHours() >= 17;
  }
}

export function useWeeklyReviewWindow(timeZone?: string | null): boolean {
  return useMemo(() => isWeeklyReviewWindow(new Date(), timeZone), [timeZone]);
}

export function closingWeekStart(reference = new Date(), timeZone?: string | null): string {
  return getWeekRange(reference, timeZone).from;
}
