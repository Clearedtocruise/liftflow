import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { PlanAdaptationResult, PlanAdjustment } from '@/types/planAdaptation';

type PlanAdjustmentContextValue = {
  adjustment: PlanAdjustment | null;
  setFromAdaptation: (result: PlanAdaptationResult) => void;
  dismiss: () => void;
};

const PlanAdjustmentContext = createContext<PlanAdjustmentContextValue | null>(null);

export function PlanAdjustmentProvider({ children }: { children: ReactNode }) {
  const [adjustment, setAdjustment] = useState<PlanAdjustment | null>(null);

  const setFromAdaptation = useCallback((result: PlanAdaptationResult) => {
    setAdjustment({
      ...result.coach,
      id: result.changeId,
      createdAt: new Date().toISOString(),
      affectedDates: result.affectedDates,
    });
  }, []);

  const dismiss = useCallback(() => setAdjustment(null), []);

  const value = useMemo(
    () => ({ adjustment, setFromAdaptation, dismiss }),
    [adjustment, setFromAdaptation, dismiss],
  );

  return <PlanAdjustmentContext.Provider value={value}>{children}</PlanAdjustmentContext.Provider>;
}

export function usePlanAdjustment() {
  const ctx = useContext(PlanAdjustmentContext);
  if (!ctx) throw new Error('usePlanAdjustment must be used within PlanAdjustmentProvider');
  return ctx;
}
