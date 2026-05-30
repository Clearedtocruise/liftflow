import { Platform } from 'react-native';

import { SUBSCRIPTION } from '@/constants/subscription';
import { fail, fromError, ok } from '@/lib/serviceResult';
import { supabase } from '@/supabase/client';
import type { ServiceResult, SubscriptionTier } from '@/types/common';
import type { Subscription } from '@/types/platform';

type CustomerInfo = { entitlements: { active: Record<string, unknown> }; originalAppUserId?: string };
type PurchasesPackage = {
  identifier: string;
  product: { identifier: string; priceString: string };
};

type PurchasesModule = {
  configure: (opts: { apiKey: string; appUserID?: string }) => void;
  setLogLevel: (level: number) => void;
  getCustomerInfo: () => Promise<CustomerInfo>;
  getOfferings: () => Promise<{ current?: { availablePackages: PurchasesPackage[] } }>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<{ customerInfo: CustomerInfo }>;
  restorePurchases: () => Promise<CustomerInfo>;
  addCustomerInfoUpdateListener: (listener: (info: CustomerInfo) => void) => void;
  removeCustomerInfoUpdateListener: (listener: (info: CustomerInfo) => void) => void;
  LOG_LEVEL: { DEBUG: number };
};

function loadPurchases(): PurchasesModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-purchases') as PurchasesModule;
  } catch {
    return null;
  }
}

function purchasesUnavailable(): ServiceResult<never> {
  return fail('In-app purchases require a development or production iOS build (not Expo Go).');
}

type SubscriptionRow = {
  id: string;
  user_id: string;
  tier: string;
  status: string;
  apple_transaction_id: string | null;
  google_purchase_token: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapSubscription(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    userId: row.user_id,
    tier: row.tier as Subscription['tier'],
    status: row.status as Subscription['status'],
    currentPeriodStart: row.current_period_start ?? undefined,
    currentPeriodEnd: row.current_period_end ?? undefined,
    cancelledAt: row.cancelled_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isPremiumActive(sub: Subscription | null): boolean {
  if (!sub) return false;
  if (sub.tier === 'free') return false;
  if (sub.status === 'active' || sub.status === 'trialing') return true;
  if (sub.status === 'cancelled' && sub.currentPeriodEnd) {
    return new Date(sub.currentPeriodEnd) > new Date();
  }
  return false;
}

function isPremiumFromCustomerInfo(info: CustomerInfo): boolean {
  return Boolean(info.entitlements.active[SUBSCRIPTION.entitlementId]);
}

async function syncSubscriptionToSupabase(
  userId: string,
  tier: SubscriptionTier,
  status: Subscription['status'],
  metadata: Record<string, unknown> = {},
): Promise<Subscription> {
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const { data, error } = await supabase
    .from('subscriptions')
    .upsert(
      {
        user_id: userId,
        tier,
        status,
        current_period_start: new Date().toISOString(),
        current_period_end: periodEnd.toISOString(),
        metadata,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return mapSubscription(data as SubscriptionRow);
}

function getRevenueCatApiKey(): string | undefined {
  return Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
    : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
}

let configuredForUser: string | null = null;

function findPremiumPackage(packages: PurchasesPackage[]): PurchasesPackage | undefined {
  return (
    packages.find(
      (p) =>
        p.product.identifier === SUBSCRIPTION.appleProductId ||
        p.product.identifier === SUBSCRIPTION.googleProductId,
    ) ?? packages[0]
  );
}

export const subscriptionService = {
  isNativePurchasesAvailable(): boolean {
    return loadPurchases() !== null;
  },

  async getSubscription(userId: string): Promise<ServiceResult<Subscription>> {
    try {
      const { data, error } = await supabase.from('subscriptions').select('*').eq('user_id', userId).maybeSingle();
      if (error) return fail(error.message);
      if (!data) return ok({ id: '', userId, tier: 'free', status: 'active', createdAt: new Date().toISOString() });
      return ok(mapSubscription(data as SubscriptionRow));
    } catch (e) {
      return fromError(e);
    }
  },

  isPremium(sub: Subscription | null): boolean {
    return isPremiumActive(sub);
  },

  async configurePurchases(userId: string): Promise<ServiceResult<void>> {
    const Purchases = loadPurchases();
    if (!Purchases) return purchasesUnavailable();

    const apiKey = getRevenueCatApiKey();
    if (!apiKey) {
      return fail('Set EXPO_PUBLIC_REVENUECAT_IOS_API_KEY in .env (dev build only).');
    }

    if (configuredForUser === userId) return ok(undefined);

    try {
      if (__DEV__) Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
      Purchases.configure({ apiKey, appUserID: userId });
      configuredForUser = userId;
      return ok(undefined);
    } catch (e) {
      return fromError(e);
    }
  },

  async syncFromRevenueCat(userId: string): Promise<ServiceResult<Subscription>> {
    const Purchases = loadPurchases();
    if (!Purchases) return purchasesUnavailable();

    try {
      const configResult = await this.configurePurchases(userId);
      if (!configResult.success) return configResult;

      const info = await Purchases.getCustomerInfo();
      if (isPremiumFromCustomerInfo(info)) {
        const sub = await syncSubscriptionToSupabase(userId, 'premium', 'active', { source: 'revenuecat_sync' });
        return ok(sub);
      }
      const sub = await syncSubscriptionToSupabase(userId, 'free', 'expired', { source: 'revenuecat_sync' });
      return ok(sub);
    } catch (e) {
      return fromError(e);
    }
  },

  async getOfferings(): Promise<ServiceResult<{ price: string; productId: string; packageId?: string }>> {
    const Purchases = loadPurchases();
    if (!Purchases) {
      return ok({ price: SUBSCRIPTION.displayPrice, productId: SUBSCRIPTION.appleProductId });
    }

    try {
      const offerings = await Purchases.getOfferings();
      const packages = offerings.current?.availablePackages ?? [];
      const pkg = findPremiumPackage(packages);

      if (!pkg) {
        return ok({ price: SUBSCRIPTION.displayPrice, productId: SUBSCRIPTION.appleProductId });
      }
      return ok({
        price: pkg.product.priceString,
        productId: pkg.product.identifier,
        packageId: pkg.identifier,
      });
    } catch {
      return ok({ price: SUBSCRIPTION.displayPrice, productId: SUBSCRIPTION.appleProductId });
    }
  },

  async purchasePremium(userId: string): Promise<ServiceResult<Subscription>> {
    const Purchases = loadPurchases();
    if (!Purchases) return purchasesUnavailable();

    try {
      const configResult = await this.configurePurchases(userId);
      if (!configResult.success) return configResult;

      const offerings = await Purchases.getOfferings();
      const packages = offerings.current?.availablePackages ?? [];
      const pkg = findPremiumPackage(packages);

      if (!pkg) {
        return fail(
          `Product ${SUBSCRIPTION.appleProductId} not found. Create it in App Store Connect and link in RevenueCat.`,
        );
      }

      const { customerInfo } = await Purchases.purchasePackage(pkg);
      if (!isPremiumFromCustomerInfo(customerInfo)) {
        return fail('Purchase completed but premium entitlement is not active.');
      }

      const sub = await syncSubscriptionToSupabase(userId, 'premium', 'active', {
        source: 'revenuecat',
        productId: pkg.product.identifier,
        transactionId: customerInfo.originalAppUserId,
      });

      if (sub.id) {
        await supabase.from('subscription_events').insert({
          subscription_id: sub.id,
          event_type: 'purchase',
          payload: { productId: pkg.product.identifier },
        });
      }

      return ok(sub);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Purchase failed';
      if (message.includes('cancelled') || message.includes('Canceled')) {
        return fail('Purchase cancelled');
      }
      return fromError(e);
    }
  },

  async restorePurchases(userId: string): Promise<ServiceResult<Subscription>> {
    const Purchases = loadPurchases();
    if (!Purchases) return purchasesUnavailable();

    try {
      const configResult = await this.configurePurchases(userId);
      if (!configResult.success) return configResult;

      const customerInfo = await Purchases.restorePurchases();
      if (!isPremiumFromCustomerInfo(customerInfo)) {
        await syncSubscriptionToSupabase(userId, 'free', 'expired', { source: 'restore' });
        return fail('No active subscription found for this Apple ID.');
      }

      const sub = await syncSubscriptionToSupabase(userId, 'premium', 'active', { source: 'restore' });
      return ok(sub);
    } catch (e) {
      return fromError(e);
    }
  },

  async cancelSubscription(userId: string): Promise<ServiceResult<Subscription>> {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select('*')
        .single();

      if (error) return fail(error.message);
      return ok(mapSubscription(data as SubscriptionRow));
    } catch (e) {
      return fromError(e);
    }
  },

  addCustomerInfoUpdateListener(userId: string, onUpdate: (isPremium: boolean) => void) {
    const Purchases = loadPurchases();
    if (!Purchases) return () => undefined;

    const listener = async (info: CustomerInfo) => {
      const premium = isPremiumFromCustomerInfo(info);
      await syncSubscriptionToSupabase(userId, premium ? 'premium' : 'free', premium ? 'active' : 'expired', {
        source: 'listener',
      });
      onUpdate(premium);
    };
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => Purchases.removeCustomerInfoUpdateListener(listener);
  },
};
