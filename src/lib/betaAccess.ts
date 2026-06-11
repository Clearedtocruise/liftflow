import { isFounderEmail } from '@/constants/founder';
import type { Subscription } from '@/types/platform';
import type { UserProfile } from '@/types/user';

import { isProSubscription } from './entitlements';

/** TestFlight / closed-beta builds — unlock all Pro surfaces for QA. */
export function isTestFlightUnlockEnabled(): boolean {
  return process.env.EXPO_PUBLIC_TESTFLIGHT_UNLOCK === 'true';
}

export function isFounderUser(user: UserProfile | null | undefined): boolean {
  if (!user) return false;
  return user.isFounder === true || isFounderEmail(user.email);
}

export function isBetaTesterUser(user: UserProfile | null | undefined): boolean {
  if (!user) return false;
  return user.isBetaTester === true || user.isInternalTester === true || Boolean(user.betaTesterTag);
}

/** Founder, beta tester, internal tester, or TestFlight unlock — bypasses all paywalls. */
export function hasUnrestrictedPremiumAccess(user: UserProfile | null | undefined): boolean {
  if (isTestFlightUnlockEnabled() && user) return true;
  return isFounderUser(user) || isBetaTesterUser(user);
}

export function resolvePremiumAccess(
  user: UserProfile | null | undefined,
  subscription: Subscription | null | undefined,
): boolean {
  if (hasUnrestrictedPremiumAccess(user)) return true;
  return isProSubscription(subscription);
}
