import type { ComponentType } from 'react';

import { ScreenErrorBoundary } from '@/components/observability/ScreenErrorBoundary';

export function withScreenBoundary<P extends object>(Screen: ComponentType<P>, screenName: string) {
  function ScreenWithBoundary(props: P) {
    return (
      <ScreenErrorBoundary screenName={screenName}>
        <Screen {...props} />
      </ScreenErrorBoundary>
    );
  }
  ScreenWithBoundary.displayName = `Boundary(${screenName})`;
  return ScreenWithBoundary;
}
