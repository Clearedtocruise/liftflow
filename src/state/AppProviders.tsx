import type { ReactNode } from 'react';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { WorkoutSessionProvider } from '@/state/workout/WorkoutSessionContext';

/**
 * Root application state providers.
 * Add new domain providers here as features are implemented.
 *
 * Provider hierarchy:
 *   AuthProvider → WorkoutSessionProvider → (future: NotificationProvider, etc.)
 */

function WorkoutSessionBridge({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return (
    <WorkoutSessionProvider userId={user?.id}>
      {children}
    </WorkoutSessionProvider>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <WorkoutSessionBridge>
        {children}
      </WorkoutSessionBridge>
    </AuthProvider>
  );
}
