import { useEffect, useRef } from 'react';

import { usePlanAdjustment } from '@/contexts/PlanAdjustmentContext';
import { useAuth } from '@/hooks/useAuth';
import type { PlanAdjustment } from '@/types/planAdaptation';

/** Survives app restarts — reads planAdjustment from profile metadata. */
export function PlanAdjustmentHydrator() {
  const { user } = useAuth();
  const { adjustment, hydrateFromProfile, bumpRevision } = usePlanAdjustment();
  const syncedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const stored = (user?.metadata as { planAdjustment?: PlanAdjustment } | undefined)?.planAdjustment;
    if (!stored?.headline || !stored.rationale) return;

    const key = stored.id ?? stored.createdAt ?? 'plan-adjustment';
    if (syncedKeyRef.current === key) return;

    if (!adjustment) {
      hydrateFromProfile(stored);
      bumpRevision();
    }

    syncedKeyRef.current = key;
  }, [adjustment, bumpRevision, hydrateFromProfile, user?.id, user?.metadata]);

  return null;
}
