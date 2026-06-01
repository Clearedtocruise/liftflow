import { useEffect } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { initMobileSentry, setMobileSentryUser } from '@/lib/sentry';

export function SentryBootstrap() {
  const { user } = useAuth();

  useEffect(() => {
    initMobileSentry();
  }, []);

  useEffect(() => {
    setMobileSentryUser(user?.id ?? null);
  }, [user?.id]);

  return null;
}
