import { resolveDisplayName } from '@/lib/resolveDisplayName';

/** Time-of-day greeting copy for the home header. */

export function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
}

/** First token of a display name — "Timothy Barrett" → "Timothy". */
export function greetingName(displayName?: string): string | undefined {
  const trimmed = displayName?.trim();
  if (!trimmed) return undefined;
  return trimmed.split(/\s+/)[0];
}

/** Resolve from profile / auth metadata / email, then take the first name. */
export function greetingNameFromAuth(input: {
  profileName?: string | null;
  metadata?: Record<string, unknown> | null;
  email?: string | null;
}): string | undefined {
  return greetingName(resolveDisplayName(input));
}
