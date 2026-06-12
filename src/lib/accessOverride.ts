import type { UserProfile } from '@/types/user';

/** Founder account — full Pro access without RevenueCat purchase. */
export const FOUNDER_EMAIL = 'immadoer@gmail.com';

export function isFounderUser(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === FOUNDER_EMAIL.toLowerCase();
}

export function isBetaTesterUser(profile: Pick<UserProfile, 'isBetaTester'> | null | undefined): boolean {
  return profile?.isBetaTester === true;
}

/** Client-side Pro override — does not modify RevenueCat or subscription sync. */
export function hasPremiumAccessOverride(user: UserProfile | null | undefined): boolean {
  if (!user) return false;
  if (isFounderUser(user.email)) return true;
  if (isBetaTesterUser(user)) return true;
  return false;
}
