import type { ReactNode } from 'react';

import { BootTestShell } from '@/components/observability/BootTestShell';
import { ScreenErrorBoundary } from '@/components/observability/ScreenErrorBoundary';
import { diagnosticAtLeast } from '@/constants/diagnosticMode';
import { AppProviders } from '@/state/AppProviders';

/** Selects boot-test shell or full provider tree based on diagnostic stage. */
export function DiagnosticAppShell({ children }: { children: ReactNode }) {
  if (!diagnosticAtLeast('supabase')) {
    return <BootTestShell />;
  }

  return (
    <ScreenErrorBoundary screenName="AppProviders">
      <AppProviders>{children}</AppProviders>
    </ScreenErrorBoundary>
  );
}
