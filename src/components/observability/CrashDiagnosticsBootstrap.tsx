import { useEffect } from 'react';

import { markCrashMarker } from '@/lib/crashDiagnostics';

/** Emits lifecycle markers after navigation shell is mounted. */
export function CrashDiagnosticsBootstrap() {
  useEffect(() => {
    markCrashMarker('NAVIGATION_READY', { shell: 'root_stack' });
  }, []);
  return null;
}
