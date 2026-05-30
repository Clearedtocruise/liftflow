import type { ReactNode } from 'react';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { WorkoutSessionProvider } from '@/state/workout/WorkoutSessionContext';

function WorkoutSessionBridge({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return <WorkoutSessionProvider userId={user?.id}>{children}</WorkoutSessionProvider>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <WorkoutSessionBridge>{children}</WorkoutSessionBridge>
      </SubscriptionProvider>
    </AuthProvider>
  );
}
