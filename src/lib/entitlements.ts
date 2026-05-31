import { PRO_FEATURE_IDS, SUBSCRIPTION, type ProFeatureId } from '@/constants/subscription';
import type { Subscription } from '@/types/platform';

const ALL_PRO_FEATURES = new Set<string>(PRO_FEATURE_IDS);

export function isProSubscription(sub: Subscription | null | undefined): boolean {
  if (!sub) return false;
  if (sub.tier === 'free') return false;
  if (sub.status === 'active' || sub.status === 'trialing') return true;
  if (sub.status === 'cancelled' && sub.currentPeriodEnd) {
    return new Date(sub.currentPeriodEnd) > new Date();
  }
  return false;
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
