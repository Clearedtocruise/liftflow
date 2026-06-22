import type { ReactNode } from 'react';

import { SentryBootstrap } from '@/components/observability/SentryBootstrap';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { PlanAdjustmentProvider } from '@/contexts/PlanAdjustmentContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { WatchCompanionBridge } from '@/state/WatchCompanionBridge';
import { WorkoutPlanDraftProvider } from '@/state/workout/WorkoutPlanDraftContext';
import { WorkoutSessionProvider } from '@/state/workout/WorkoutSessionContext';
import { VoiceWorkoutProvider } from '@/voice/VoiceWorkoutProvider';
import { VoiceWorkoutSettingsBridge } from '@/voice/VoiceWorkoutSettingsBridge';

function WorkoutSessionBridge({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return (
    <WorkoutSessionProvider userId={user?.id}>
      <WorkoutPlanDraftProvider>
        <VoiceWorkoutProvider>
          <VoiceWorkoutSettingsBridge userId={user?.id} />
          <WatchCompanionBridge userId={user?.id}>{children}</WatchCompanionBridge>
        </VoiceWorkoutProvider>
      </WorkoutPlanDraftProvider>
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
