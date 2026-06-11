import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { PRO_FEATURE_LABELS, type ProFeatureId } from '@/constants/subscription';
import { useAuth } from '@/hooks/useAuth';
import { hasProFeature, isTrialingSubscription } from '@/lib/entitlements';
import { forensicLog, forensicLogError } from '@/lib/forensicLog';
import { notificationService } from '@/services/notificationService';
import { productAnalyticsService } from '@/services/productAnalyticsService';
import { subscriptionService } from '@/services/subscriptionService';
import type { Subscription } from '@/types/platform';

type SubscriptionContextValue = {
  subscription: Subscription | null;
  isPremium: boolean;
  isTrialing: boolean;
  isPro: boolean;
  loading: boolean;
  isNativePurchasesAvailable: boolean;
  isRevenueCatConfigured: boolean;
  hasFeature: (featureId: ProFeatureId) => boolean;
  featureLabel: (featureId: ProFeatureId) => string;
  refresh: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const prevSubscriptionRef = useRef<Subscription | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    forensicLog('REVENUECAT_INIT_START', { userId: user.id });
    try {
      const rcResult = await subscriptionService.syncFromRevenueCat(user.id);
      if (rcResult.success) {
        setSubscription(rcResult.data);
        setLoading(false);
        forensicLog('REVENUECAT_INIT_SUCCESS', { source: 'revenuecat' });
        return;
      }
    } catch (error) {
      forensicLogError('REVENUECAT_INIT_FAIL', error, { phase: 'revenuecat_sync' });
    }
    try {
      const result = await subscriptionService.getSubscription(user.id);
      if (result.success) setSubscription(result.data);
      setLoading(false);
      forensicLog('REVENUECAT_INIT_SUCCESS', { source: 'supabase_fallback' });
    } catch (error) {
      setLoading(false);
      forensicLogError('REVENUECAT_INIT_FAIL', error, { phase: 'supabase_fallback' });
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user || !subscription) return;
    const prev = prevSubscriptionRef.current;
    if (prev?.id === subscription.id && prev.status === subscription.status && prev.tier === subscription.tier) {
      return;
    }
    if (isTrialingSubscription(subscription) && !prev) {
      void productAnalyticsService.trackSubscription(user.id, 'started');
    }
    if (
      subscriptionService.isPremium(subscription) &&
      prev &&
      !subscriptionService.isPremium(prev) &&
      !isTrialingSubscription(subscription)
    ) {
      void productAnalyticsService.trackSubscription(user.id, 'converted');
    }
    prevSubscriptionRef.current = subscription;
  }, [user, subscription]);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    let removeListener: (() => void) | undefined;

    void (async () => {
      notificationService.registerDevice(user.id).catch(() => undefined);
      notificationService.scheduleWorkoutReminder(18, 0).catch(() => undefined);

      const config = await subscriptionService.configurePurchases(user.id);
      if (cancelled || !config.success) return;

      try {
        removeListener = subscriptionService.addCustomerInfoUpdateListener(user.id, () => {
          void refresh();
        });
      } catch {
        // RevenueCat unavailable
      }
    })();

    return () => {
      cancelled = true;
      removeListener?.();
    };
  }, [user, refresh]);

  const isPremium = subscriptionService.isPremium(subscription);
  const isTrialing = isTrialingSubscription(subscription);

  const hasFeature = useCallback(
    (featureId: ProFeatureId) => hasProFeature(subscription, featureId),
    [subscription],
  );

  const featureLabel = useCallback((featureId: ProFeatureId) => PRO_FEATURE_LABELS[featureId], []);

  const value = useMemo(
    () => ({
      subscription,
      isPremium,
      isPro: isPremium,
      isTrialing,
      loading,
      isNativePurchasesAvailable: subscriptionService.isNativePurchasesAvailable(),
      isRevenueCatConfigured: subscriptionService.isRevenueCatConfigured(),
      hasFeature,
      featureLabel,
      refresh,
    }),
    [subscription, isPremium, isTrialing, loading, hasFeature, featureLabel, refresh],
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscriptionContext(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscriptionContext requires SubscriptionProvider');
  return ctx;
}
