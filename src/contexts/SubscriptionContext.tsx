import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { notificationService } from '@/services/notificationService';
import { subscriptionService } from '@/services/subscriptionService';
import type { Subscription } from '@/types/platform';

type SubscriptionContextValue = {
  subscription: Subscription | null;
  isPremium: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const rcResult = await subscriptionService.syncFromRevenueCat(user.id);
      if (rcResult.success) {
        setSubscription(rcResult.data);
        setLoading(false);
        return;
      }
    } catch {
      // RevenueCat not configured — fall back to Supabase
    }
    const result = await subscriptionService.getSubscription(user.id);
    if (result.success) setSubscription(result.data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;

    subscriptionService.configurePurchases(user.id).catch(() => undefined);
    notificationService.registerDevice(user.id).catch(() => undefined);
    notificationService.scheduleWorkoutReminder(18, 0).catch(() => undefined);

    let removeListener: (() => void) | undefined;
    try {
      removeListener = subscriptionService.addCustomerInfoUpdateListener(user.id, () => {
        void refresh();
      });
    } catch {
      // RevenueCat unavailable in Expo Go
    }

    return () => removeListener?.();
  }, [user, refresh]);

  const value = useMemo(
    () => ({
      subscription,
      isPremium: subscriptionService.isPremium(subscription),
      loading,
      refresh,
    }),
    [subscription, loading, refresh],
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscriptionContext(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscriptionContext requires SubscriptionProvider');
  return ctx;
}
