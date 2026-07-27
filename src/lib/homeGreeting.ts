/** Time-of-day greeting copy for the home header. Pure so validate scripts can import it. */

export function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
}

/** First token of the profile display name — "Timothy Barrett" → "Timothy". */
export function greetingName(displayName?: string): string | undefined {
  const trimmed = displayName?.trim();
  if (!trimmed) return undefined;
  return trimmed.split(/\s+/)[0];
}
