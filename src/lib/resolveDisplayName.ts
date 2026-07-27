/**
 * Resolve what the home greeting should call the lifter.
 *
 * Only a real name counts — profile display name, or auth metadata from signup.
 * Never invent a name from an email local-part; that reads as a bug.
 */

export function resolveDisplayName(input: {
  profileName?: string | null;
  metadata?: Record<string, unknown> | null;
}): string | undefined {
  const fromProfile = cleanName(input.profileName);
  if (fromProfile) return fromProfile;

  const meta = input.metadata ?? {};
  return (
    cleanName(meta.display_name) ??
    cleanName(meta.full_name) ??
    cleanName(meta.name) ??
    cleanName(
      [meta.given_name, meta.family_name]
        .map((part) => (typeof part === 'string' ? part.trim() : ''))
        .filter(Boolean)
        .join(' '),
    )
  );
}

function cleanName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed.length > 0 ? trimmed : undefined;
}
