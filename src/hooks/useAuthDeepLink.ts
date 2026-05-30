import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { createSessionFromUrl, isAuthCallbackUrl } from '@/lib/authSessionFromUrl';

async function handleAuthCallbackUrl(url: string): Promise<void> {
  if (!isAuthCallbackUrl(url)) return;

  const result = await createSessionFromUrl(url);
  if (!result.ok) {
    router.replace({ pathname: '/(auth)/login', params: { authError: result.error ?? 'Auth link failed.' } });
    return;
  }

  if (url.includes('reset-password') || url.includes('type=recovery')) {
    router.replace('/(auth)/reset-password');
    return;
  }

  router.replace({ pathname: '/(auth)/login', params: { verified: '1' } });
}

export function useAuthDeepLink(): void {
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) void handleAuthCallbackUrl(url);
    });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      void handleAuthCallbackUrl(url);
    });

    return () => subscription.remove();
  }, []);
}
