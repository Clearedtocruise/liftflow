/**
 * Subscription tier ranking shared by the API gates.
 *
 * ONE MORE now has three paid capability levels:
 *   - Basic  ($4.99/mo): custom day-based programs, looping, workout/rest days, history, nutrition.
 *   - Pro/Premium ($9.99/mo): everything in Basic plus AI coach, recovery, nutrition intelligence…
 *   - premium_plus: reserved higher tier (treated as Pro+).
 *
 * Ranking makes the gates monotonic: a Pro subscriber automatically satisfies a Basic-only route,
 * but a Basic subscriber must NOT satisfy a Pro-only route.
 */

export type SubscriptionTierName = 'free' | 'basic' | 'premium' | 'premium_plus';

export const TIER_RANK: Record<SubscriptionTierName, number> = {
  free: 0,
  basic: 1,
  premium: 2,
  premium_plus: 3,
};

export function tierRank(tier: string | null | undefined): number {
  if (!tier) return 0;
  return TIER_RANK[tier as SubscriptionTierName] ?? 0;
}

/** Basic and above ($4.99+): custom programs, looping, nutrition persistence. */
export const BASIC_MIN_RANK = TIER_RANK.basic;
/** Premium and above ($9.99+): AI/intelligence features. */
export const PRO_MIN_RANK = TIER_RANK.premium;

type SubscriptionRow = {
  tier?: string | null;
  status?: string | null;
  current_period_end?: string | null;
} | null;

/** An entitlement is live when active/trialing, or cancelled-but-still-inside the paid period. */
export function subscriptionIsActive(row: SubscriptionRow, now: Date = new Date()): boolean {
  if (!row) return false;
  if (row.status === 'active' || row.status === 'trialing') return true;
  if (row.status === 'cancelled' && row.current_period_end) {
    return new Date(row.current_period_end) > now;
  }
  return false;
}

/** True when the row grants at least `minRank` (e.g. Basic route needs BASIC_MIN_RANK). */
export function subscriptionMeetsRank(row: SubscriptionRow, minRank: number, now: Date = new Date()): boolean {
  if (!row || tierRank(row.tier) < minRank) return false;
  return subscriptionIsActive(row, now);
}

/** Maps a RevenueCat/App Store product id to the tier it grants. Unknown paid products → premium. */
export function tierForProductId(productId: string | null | undefined): SubscriptionTierName | null {
  if (!productId) return null;
  const id = productId.toLowerCase();
  if (id.includes('basic')) return 'basic';
  if (id.includes('premium_plus') || id.includes('premiumplus')) return 'premium_plus';
  if (id.includes('premium') || id.includes('pro')) return 'premium';
  return null;
}
