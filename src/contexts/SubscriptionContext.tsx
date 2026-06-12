import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { PRO_FEATURE_LABELS, type ProFeatureId } from '@/constants/subscription';
import { useAuth } from '@/hooks/useAuth';
import { hasPremiumAccessOverride, isBetaTesterUser, isFounderUser } from '@/lib/accessOverride';
import { hasProFeature, isTrialingSubscription } from '@/lib/entitlements';
import { productAnalyticsService } from '@/services/productAnalyticsService';
import { subscriptionService } from '@/services/subscriptionService';
import type { Subscription } from '@/types/platform';

type SubscriptionContextValue = {
  subscription: Subscription | null;
  isPremium: boolean;
  isTrialing: boolean;
  isPro: boolean;
  isFounder: boolean;
  isBetaTester: boolean;
  loading: boolean;
  isNativePurchasesAvailable: boolean;
  isRevenueCatConfigured: boolean;
  hasFeature: (featureId: ProFeatureId) => boolean;
  featureLabel: (featureId: ProFeatureId) => string;
  refresh: (options?: { showLoading?: boolean }) => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(false);
  const prevSubscriptionRef = useRef<Subscription | null>(null);

  const refresh = useCallback(async (options?: { showLoading?: boolean }) => {
    if (!user) {
      setSubscription(null);
      return;
    }

    if (options?.showLoading) setLoading(true);
    try {
      try {
        const rcResult = await subscriptionService.syncFromRevenueCat(user.id);
        if (rcResult.success) {
          setSubscription(rcResult.data);
          return;
        }
      } catch {
        // RevenueCat not configured — fall back to Supabase
      }

      const result = await subscriptionService.getSubscription(user.id);
      if (result.success) setSubscription(result.data);
    } finally {
      if (options?.showLoading) setLoading(false);
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
      const { notificationService } = await import('@/services/notificationService');
      await notificationService.initializeNotificationsSafely();
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

  const premiumOverride = hasPremiumAccessOverride(user);
  const isFounder = isFounderUser(user?.email);
  const isBetaTester = isBetaTesterUser(user);
  const isPremium = premiumOverride || subscriptionService.isPremium(subscription);
  const isTrialing = !premiumOverride && isTrialingSubscription(subscription);

  const hasFeature = useCallback(
    (featureId: ProFeatureId) => premiumOverride || hasProFeature(subscription, featureId),
    [subscription, premiumOverride],
  );

  const featureLabel = useCallback((featureId: ProFeatureId) => PRO_FEATURE_LABELS[featureId], []);

  const value = useMemo(
    () => ({
      subscription,
      isPremium,
      isPro: isPremium,
      isFounder,
      isBetaTester,
      isTrialing,
      loading,
      isNativePurchasesAvailable: subscriptionService.isNativePurchasesAvailable(),
      isRevenueCatConfigured: subscriptionService.isRevenueCatConfigured(),
      hasFeature,
      featureLabel,
      refresh,
    }),
    [subscription, isPremium, isFounder, isBetaTester, isTrialing, loading, hasFeature, featureLabel, refresh],
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscriptionContext(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscriptionContext requires SubscriptionProvider');
  return ctx;
}
