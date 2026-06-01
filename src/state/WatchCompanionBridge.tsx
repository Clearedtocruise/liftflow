import type { ReactNode } from 'react';

import { useWatchCompanionSync } from '@/hooks/useWatchCompanionSync';

function WatchCompanionBridge({ userId, children }: { userId?: string; children: ReactNode }) {
  useWatchCompanionSync(userId);
  return children;
}

export { WatchCompanionBridge };
