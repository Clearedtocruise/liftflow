import { BASIC_FEATURE_IDS, PRO_FEATURE_IDS, SUBSCRIPTION, type BasicFeatureId, type ProFeatureId } from '@/constants/subscription';
import type { SubscriptionTier } from '@/types/common';
import type { Subscription } from '@/types/platform';

const ALL_PRO_FEATURES = new Set<string>(PRO_FEATURE_IDS);
const ALL_BASIC_FEATURES = new Set<string>(BASIC_FEATURE_IDS);

/** Ranked so Pro is a strict superset of Basic. */
const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  basic: 1,
  premium: 2,
  premium_plus: 3,
};

function subscriptionTierRank(sub: Subscription | null | undefined): number {
  if (!sub) return 0;
  return TIER_RANK[sub.tier] ?? 0;
}

/** Live when active/trialing, or cancelled but still inside the paid period. */
function subscriptionIsActive(sub: Subscription | null | undefined): boolean {
  if (!sub) return false;
  if (sub.status === 'active' || sub.status === 'trialing') return true;
  if (sub.status === 'cancelled' && sub.currentPeriodEnd) {
    return new Date(sub.currentPeriodEnd) > new Date();
  }
  return false;
}

/** Pro/Premium and above ($9.99+). */
export function isProSubscription(sub: Subscription | null | undefined): boolean {
  if (subscriptionTierRank(sub) < TIER_RANK.premium) return false;
  return subscriptionIsActive(sub);
}

/** Basic and above ($4.99+). Pro subscribers pass this too. */
export function isBasicSubscription(sub: Subscription | null | undefined): boolean {
  if (subscriptionTierRank(sub) < TIER_RANK.basic) return false;
  return subscriptionIsActive(sub);
}

/** Custom day-based programs, looping, and persistent nutrition require Basic or above. */
export function hasBasicFeature(sub: Subscription | null | undefined, featureId: BasicFeatureId): boolean {
  if (!ALL_BASIC_FEATURES.has(featureId)) return true;
  return isBasicSubscription(sub);
}

export function hasProFeature(sub: Subscription | null | undefined, featureId: ProFeatureId): boolean {
  if (!ALL_PRO_FEATURES.has(featureId)) return true;
  return isProSubscription(sub);
}

export function isTrialingSubscription(sub: Subscription | null | undefined): boolean {
  return Boolean(sub && sub.status === 'trialing' && isProSubscription(sub));
}

export function resolveEntitlementIds(): string[] {
  return [SUBSCRIPTION.entitlementId, SUBSCRIPTION.legacyEntitlementId];
}

export function entitlementActive(activeEntitlements: Record<string, unknown>): boolean {
  return resolveEntitlementIds().some((id) => Boolean(activeEntitlements[id]));
}

export function pickActiveEntitlement(activeEntitlements: Record<string, unknown>): string | undefined {
  return resolveEntitlementIds().find((id) => Boolean(activeEntitlements[id]));
}
