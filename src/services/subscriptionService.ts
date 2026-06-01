import { Platform } from 'react-native';

import { SUBSCRIPTION } from '@/constants/subscription';
import { entitlementActive, isProSubscription } from '@/lib/entitlements';
import { fail, fromError, ok } from '@/lib/serviceResult';
import { supabase } from '@/supabase/client';
import type { ServiceResult, SubscriptionTier } from '@/types/common';
import type { Subscription } from '@/types/platform';

type EntitlementInfo = {
  identifier?: string;
  isActive?: boolean;
  periodType?: string;
  expirationDate?: string | null;
  productIdentifier?: string;
  willRenew?: boolean;
};

type CustomerInfo = {
  entitlements: { active: Record<string, EntitlementInfo> };
  originalAppUserId?: string;
};

type PurchasesPackage = {
  identifier: string;
  product: { identifier: string; priceString: string; introPrice?: { priceString: string; period?: string } | null };
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

export type OfferingDetails = {
  price: string;
  productId: string;
  packageId?: string;
  hasTrial: boolean;
  trialLabel?: string;
};

export type EntitlementStatus = {
  isPro: boolean;
  isTrialing: boolean;
  expirationDate?: string;
  productId?: string;
  willRenew?: boolean;
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
  metadata: Record<string, unknown> | null;
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

function parseEntitlementStatus(info: CustomerInfo): EntitlementStatus {
  const active = info.entitlements.active;
  const entitlement =
    active[SUBSCRIPTION.entitlementId] ?? active[SUBSCRIPTION.legacyEntitlementId];
  const isPro = entitlementActive(active);
  const isTrialing = isPro && entitlement?.periodType?.toUpperCase() === 'TRIAL';

  return {
    isPro,
    isTrialing,
    expirationDate: entitlement?.expirationDate ?? undefined,
    productId: entitlement?.productIdentifier,
    willRenew: entitlement?.willRenew,
  };
}

function resolveSubscriptionStatus(entitlement: EntitlementStatus): Subscription['status'] {
  if (!entitlement.isPro) return 'expired';
  return entitlement.isTrialing ? 'trialing' : 'active';
}

async function logSubscriptionEvent(
  subscriptionId: string,
  eventType: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  if (!subscriptionId) return;
  await supabase.from('subscription_events').insert({
    subscription_id: subscriptionId,
    event_type: eventType,
    payload,
  });
}

async function syncSubscriptionToSupabase(
  userId: string,
  tier: SubscriptionTier,
  status: Subscription['status'],
  metadata: Record<string, unknown> = {},
): Promise<Subscription> {
  const periodEnd = metadata.expirationDate
    ? new Date(String(metadata.expirationDate))
    : (() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        return d;
      })();

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

  isRevenueCatConfigured(): boolean {
    return Boolean(getRevenueCatApiKey());
  },

  async getSubscription(userId: string): Promise<ServiceResult<Subscription>> {
    try {
      const { data, error } = await supabase.from('subscriptions').select('*').eq('user_id', userId).maybeSingle();
      if (error) return fail(error.message);
      if (!data) {
        return ok({
          id: '',
          userId,
          tier: 'free',
          status: 'active',
          createdAt: new Date().toISOString(),
        });
      }
      return ok(mapSubscription(data as SubscriptionRow));
    } catch (e) {
      return fromError(e);
    }
  },

  isPremium(sub: Subscription | null): boolean {
    return isProSubscription(sub);
  },

  async getEntitlementStatus(userId: string): Promise<ServiceResult<EntitlementStatus>> {
    const Purchases = loadPurchases();
    if (!Purchases) {
      const sub = await this.getSubscription(userId);
      if (!sub.success) return sub;
      return ok({
        isPro: this.isPremium(sub.data),
        isTrialing: sub.data.status === 'trialing',
        expirationDate: sub.data.currentPeriodEnd,
      });
    }

    try {
      const configResult = await this.configurePurchases(userId);
      if (!configResult.success) return configResult;

      const info = await Purchases.getCustomerInfo();
      return ok(parseEntitlementStatus(info));
    } catch (e) {
      return fromError(e);
    }
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
      const entitlement = parseEntitlementStatus(info);
      const tier: SubscriptionTier = entitlement.isPro ? SUBSCRIPTION.tier : 'free';
      const status = resolveSubscriptionStatus(entitlement);

      const sub = await syncSubscriptionToSupabase(userId, tier, status, {
        source: 'revenuecat_sync',
        productId: entitlement.productId,
        expirationDate: entitlement.expirationDate,
        isTrialing: entitlement.isTrialing,
      });

      return ok(sub);
    } catch (e) {
      return fromError(e);
    }
  },

  async getOfferings(): Promise<ServiceResult<OfferingDetails>> {
    const Purchases = loadPurchases();
    const fallback: OfferingDetails = {
      price: SUBSCRIPTION.displayPrice,
      productId: SUBSCRIPTION.appleProductId,
      hasTrial: SUBSCRIPTION.trialDays > 0,
      trialLabel: SUBSCRIPTION.trialLabel,
    };

    if (!Purchases) return ok(fallback);

    try {
      const offerings = await Purchases.getOfferings();
      const packages = offerings.current?.availablePackages ?? [];
      const pkg = findPremiumPackage(packages);

      if (!pkg) return ok(fallback);

      const hasTrial = Boolean(pkg.product.introPrice);
      return ok({
        price: pkg.product.priceString,
        productId: pkg.product.identifier,
        packageId: pkg.identifier,
        hasTrial,
        trialLabel: hasTrial ? SUBSCRIPTION.trialLabel : undefined,
      });
    } catch {
      return ok(fallback);
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
      const entitlement = parseEntitlementStatus(customerInfo);
      if (!entitlement.isPro) {
        return fail('Purchase completed but Pro entitlement is not active.');
      }

      const status = resolveSubscriptionStatus(entitlement);
      const sub = await syncSubscriptionToSupabase(userId, SUBSCRIPTION.tier, status, {
        source: 'revenuecat',
        productId: pkg.product.identifier,
        expirationDate: entitlement.expirationDate,
        isTrialing: entitlement.isTrialing,
        transactionId: customerInfo.originalAppUserId,
      });

      await logSubscriptionEvent(sub.id, entitlement.isTrialing ? 'trial_started' : 'purchase', {
        productId: pkg.product.identifier,
        packageId: pkg.identifier,
      });

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
      const entitlement = parseEntitlementStatus(customerInfo);

      if (!entitlement.isPro) {
        await syncSubscriptionToSupabase(userId, 'free', 'expired', { source: 'restore' });
        return fail('No active Pro subscription found for this Apple ID.');
      }

      const status = resolveSubscriptionStatus(entitlement);
      const sub = await syncSubscriptionToSupabase(userId, SUBSCRIPTION.tier, status, {
        source: 'restore',
        productId: entitlement.productId,
        expirationDate: entitlement.expirationDate,
        isTrialing: entitlement.isTrialing,
      });

      await logSubscriptionEvent(sub.id, 'restore', { productId: entitlement.productId });
      return ok(sub);
    } catch (e) {
      return fromError(e);
    }
  },

  /** Sandbox / QA — grants Pro via backend when RevenueCat is unavailable */
  async grantSandboxPro(userId: string, token: string): Promise<ServiceResult<Subscription>> {
    try {
      const { API_BASE_URL } = await import('@/constants/api');
      const res = await fetch(`${API_BASE_URL}/api/subscriptions/upgrade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tier: SUBSCRIPTION.tier, sandbox: true }),
      });
      const body = await res.json();
      if (!res.ok) return fail(body.message ?? 'Sandbox upgrade failed');
      return ok(body as Subscription);
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
      const sub = mapSubscription(data as SubscriptionRow);
      await logSubscriptionEvent(sub.id, 'cancelled', {});
      return ok(sub);
    } catch (e) {
      return fromError(e);
    }
  },

  addCustomerInfoUpdateListener(userId: string, onUpdate: (isPremium: boolean) => void) {
    const Purchases = loadPurchases();
    if (!Purchases || !getRevenueCatApiKey()) return () => undefined;
    if (configuredForUser !== userId) return () => undefined;

    const listener = async (info: CustomerInfo) => {
      const entitlement = parseEntitlementStatus(info);
      const tier: SubscriptionTier = entitlement.isPro ? SUBSCRIPTION.tier : 'free';
      const status = resolveSubscriptionStatus(entitlement);
      await syncSubscriptionToSupabase(userId, tier, status, {
        source: 'listener',
        productId: entitlement.productId,
        expirationDate: entitlement.expirationDate,
        isTrialing: entitlement.isTrialing,
      });
      onUpdate(entitlement.isPro);
    };
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => Purchases.removeCustomerInfoUpdateListener(listener);
  },
};
