/** Emails that receive permanent founder + unrestricted premium access. */
export const FOUNDER_EMAILS = ['clearedtocruise@gmail.com'] as const;

export function isFounderEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return FOUNDER_EMAILS.some((founder) => founder.toLowerCase() === normalized);
}
