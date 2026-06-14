import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { localDateString } from '@/lib/localDate';

/** Reload data when the local calendar day changes (midnight rollover or app resume). */
export function useLocalDayRollover(
  timeZone: string | null | undefined,
  onRollover: () => void,
): void {
  const dayRef = useRef(localDateString(new Date(), timeZone));
  const onRolloverRef = useRef(onRollover);
  onRolloverRef.current = onRollover;

  useEffect(() => {
    dayRef.current = localDateString(new Date(), timeZone);

    const checkRollover = () => {
      const nextDay = localDateString(new Date(), timeZone);
      if (nextDay === dayRef.current) return;
      dayRef.current = nextDay;
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
