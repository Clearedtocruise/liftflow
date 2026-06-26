import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactNode } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { logStartup } from '@/lib/startupLogger';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

type SplashControllerProps = {
  children: ReactNode;
};

/** Hides the native splash once auth bootstrap finishes for a seamless handoff. */
export function SplashController({ children }: SplashControllerProps) {
  const { isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    void SplashScreen.hideAsync()
      .then(() => logStartup('SPLASH_HIDDEN'))
      .catch(() => undefined);
  }, [isLoading]);

  return children;
}
