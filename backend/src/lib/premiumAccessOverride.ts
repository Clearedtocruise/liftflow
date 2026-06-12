/** Founder account — full Pro access without RevenueCat purchase (matches client accessOverride.ts). */
export const FOUNDER_EMAIL = 'immadoer@gmail.com';

export function isFounderEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === FOUNDER_EMAIL.toLowerCase();
}

export function hasPremiumProfileAccess(
  profile: { email?: string | null; is_beta_tester?: boolean | null } | null | undefined,
): boolean {
  if (!profile) return false;
  if (isFounderEmail(profile.email)) return true;
  if (profile.is_beta_tester === true) return true;
  return false;
}
