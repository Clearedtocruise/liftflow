import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { PlanAdaptationResult, PlanAdjustment } from '@/types/planAdaptation';

type PlanAdjustmentContextValue = {
  adjustment: PlanAdjustment | null;
  /** Increments on each adaptation so tabs can reload plan data. */
  revision: number;
  setFromAdaptation: (result: PlanAdaptationResult) => void;
  bumpRevision: () => void;
  dismiss: () => void;
};

const PlanAdjustmentContext = createContext<PlanAdjustmentContextValue | null>(null);

export function PlanAdjustmentProvider({ children }: { children: ReactNode }) {
  const [adjustment, setAdjustment] = useState<PlanAdjustment | null>(null);
  const [revision, setRevision] = useState(0);

  const setFromAdaptation = useCallback((result: PlanAdaptationResult) => {
    setAdjustment({
      ...result.coach,
      id: result.changeId,
      createdAt: new Date().toISOString(),
      affectedDates: result.affectedDates,
    });
    setRevision((n) => n + 1);
  }, []);

  const bumpRevision = useCallback(() => setRevision((n) => n + 1), []);

  const dismiss = useCallback(() => setAdjustment(null), []);

  const value = useMemo(
    () => ({ adjustment, revision, setFromAdaptation, bumpRevision, dismiss }),
    [adjustment, revision, setFromAdaptation, bumpRevision, dismiss],
  );

  return <PlanAdjustmentContext.Provider value={value}>{children}</PlanAdjustmentContext.Provider>;
}

export function usePlanAdjustment() {
  const ctx = useContext(PlanAdjustmentContext);
  if (!ctx) throw new Error('usePlanAdjustment must be used within PlanAdjustmentProvider');
  return ctx;
}
