import { useEffect } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { setMobileSentryUser } from '@/lib/sentry';

export function SentryBootstrap() {
  const { user } = useAuth();

  useEffect(() => {
    setMobileSentryUser(user?.id ?? null);
  }, [user?.id]);

  return null;
}
