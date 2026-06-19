import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';

import { useLocalDayRollover } from '@/hooks/useLocalDayRollover';
import { localDateString } from '@/lib/localDate';

/** Local YYYY-MM-DD that refreshes at midnight, on app resume, and when the screen gains focus. */
export function useLocalCalendarDay(timeZone?: string | null): string {
  const [day, setDay] = useState(() => localDateString(new Date(), timeZone));

  const refresh = useCallback(() => {
    setDay(localDateString(new Date(), timeZone));
  }, [timeZone]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useLocalDayRollover(timeZone, refresh);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return day;
}
