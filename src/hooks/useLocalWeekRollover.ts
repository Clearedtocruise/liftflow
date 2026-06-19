import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { recordWeeklyRolloverTime } from '@/lib/rolloverDebug';
import { getWeekRange } from '@/lib/weekPlan';

/** Reload data when the local calendar week changes (Monday rollover or app resume). */
export function useLocalWeekRollover(
  timeZone: string | null | undefined,
  onRollover: () => void,
): void {
  const weekRef = useRef(getWeekRange(new Date(), timeZone).from);
  const onRolloverRef = useRef(onRollover);
  onRolloverRef.current = onRollover;

  useEffect(() => {
    weekRef.current = getWeekRange(new Date(), timeZone).from;

    const checkRollover = () => {
      const nextWeekStart = getWeekRange(new Date(), timeZone).from;
      if (nextWeekStart === weekRef.current) return;
      weekRef.current = nextWeekStart;
      void recordWeeklyRolloverTime();
      onRolloverRef.current();
    };

    const interval = setInterval(checkRollover, 60_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkRollover();
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [timeZone]);
}
