import type { UserProfile } from '@/types/user';

/** Resolved from profiles.is_founder (+ legacy beta_tester_tag). */
export function isFounderUser(user: UserProfile | null | undefined): boolean {
  if (!user) return false;
  if (user.isFounder) return true;
  return user.betaTesterTag === 'founder';
}

/** Resolved from profiles.is_beta_tester (+ legacy internal tester / invite). */
export function isBetaTesterUser(user: UserProfile | null | undefined): boolean {
  if (!user) return false;
  if (user.isBetaTester) return true;
  if (user.isInternalTester) return true;
  if (user.betaTesterTag === 'beta' || user.betaTesterTag === 'internal') return true;
  return Boolean(user.betaInviteCode);
}

/** Full premium access without RevenueCat — founder or beta tester only. */
export function hasPremiumAccessOverride(user: UserProfile | null | undefined): boolean {
  return isFounderUser(user) || isBetaTesterUser(user);
}

export function accessOverrideLabel(user: UserProfile | null | undefined): string | null {
  if (isFounderUser(user)) return 'Founder Access';
  if (isBetaTesterUser(user)) return 'Beta Tester Access';
  return null;
}
