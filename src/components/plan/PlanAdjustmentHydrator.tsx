import { useEffect } from 'react';

import { usePlanAdjustment } from '@/contexts/PlanAdjustmentContext';
import { useAuth } from '@/hooks/useAuth';
import type { PlanAdjustment } from '@/types/planAdaptation';

/** Survives app restarts — reads planAdjustment from profile metadata. */
export function PlanAdjustmentHydrator() {
  const { user } = useAuth();
  const { hydrateFromProfile } = usePlanAdjustment();

  useEffect(() => {
    const stored = (user?.metadata as { planAdjustment?: PlanAdjustment } | undefined)?.planAdjustment;
    hydrateFromProfile(stored);
  }, [user?.id, user?.metadata, hydrateFromProfile]);

  return null;
}
