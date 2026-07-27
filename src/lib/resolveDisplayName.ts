/**
 * Resolve what the home greeting (and settings) should call the lifter.
 *
 * Signup writes the name into auth `user_metadata.display_name`, but the profiles trigger only
 * inserts id+email — so `profiles.display_name` stays null and Home greets nobody. Pull from every
 * place a name might already live before giving up.
 */

export function resolveDisplayName(input: {
  profileName?: string | null;
  metadata?: Record<string, unknown> | null;
  email?: string | null;
}): string | undefined {
  const fromProfile = cleanName(input.profileName);
  if (fromProfile) return fromProfile;

  const meta = input.metadata ?? {};
  const fromMeta =
    cleanName(meta.display_name) ??
    cleanName(meta.full_name) ??
    cleanName(meta.name) ??
    cleanName(
      [meta.given_name, meta.family_name]
        .map((part) => (typeof part === 'string' ? part.trim() : ''))
        .filter(Boolean)
        .join(' '),
    );
  if (fromMeta) return fromMeta;

  return nameFromEmail(input.email);
}

function cleanName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed.length > 0 ? trimmed : undefined;
}

/** `timothy.barrett+test@x.com` → `Timothy` — better than greeting nobody. */
function nameFromEmail(email?: string | null): string | undefined {
  if (!email) return undefined;
  const local = email.split('@')[0]?.split('+')[0]?.trim();
  if (!local) return undefined;
  const token = local.split(/[._-]/)[0];
  if (!token) return undefined;
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}
