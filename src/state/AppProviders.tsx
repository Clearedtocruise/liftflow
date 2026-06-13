import type { ReactNode } from 'react';

import { SentryBootstrap } from '@/components/observability/SentryBootstrap';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { PlanAdjustmentProvider } from '@/contexts/PlanAdjustmentContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { WatchCompanionBridge } from '@/state/WatchCompanionBridge';
import { WorkoutSessionProvider } from '@/state/workout/WorkoutSessionContext';

function WorkoutSessionBridge({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return (
    <WorkoutSessionProvider userId={user?.id}>
      <WatchCompanionBridge userId={user?.id}>{children}</WatchCompanionBridge>
    </WorkoutSessionProvider>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </AuthProvider>
  );
}

function AuthenticatedShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SentryBootstrap />
      <SubscriptionProvider>
        <PlanAdjustmentProvider>
          <WorkoutSessionBridge>{children}</WorkoutSessionBridge>
        </PlanAdjustmentProvider>
      </SubscriptionProvider>
    </>
  );
}
