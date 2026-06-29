import { useEffect, useRef } from 'react';

import { usePlanAdjustment } from '@/contexts/PlanAdjustmentContext';
import { useAuth } from '@/hooks/useAuth';
import { planDataCache } from '@/lib/planDataCache';
import { getWeekRange } from '@/lib/weekPlan';

/** Drop stale week cache whenever the plan revision bumps (swap, hydrate, etc.). */
export function PlanRevisionCacheInvalidator() {
  const { user } = useAuth();
  const { revision } = usePlanAdjustment();
  const lastRevisionRef = useRef(0);

  useEffect(() => {
    if (!user?.id || revision <= lastRevisionRef.current) return;
    lastRevisionRef.current = revision;

    const { from, to } = getWeekRange(new Date(), user.timezone);
    void planDataCache.clearWeekPlan(user.id, from, to);
  }, [revision, user?.id, user?.timezone]);

  return null;
}
