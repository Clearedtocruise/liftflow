/**
 * Sentry release identity.
 *
 * `EXPO_PUBLIC_SENTRY_RELEASE` is pinned to `liftflow@1.0.0` for every store build, so builds 344
 * through 348 all reported as the same release. Issues could not be attributed to a build and
 * never resolved when a fix shipped, which makes "is this fixed?" unanswerable from the dashboard.
 * Appending the native build number separates them.
 */

export const FALLBACK_RELEASE = 'liftflow@1.0.0';

/**
 * `liftflow@1.0.0+348`. The build number is Sentry's `dist`, and a release that already carries a
 * build is left alone so this stays safe to apply twice.
 */
export function formatSentryRelease(
  baseRelease: string | undefined | null,
  buildVersion: string | undefined | null,
): string {
  const base = (baseRelease ?? '').trim() || FALLBACK_RELEASE;
  const build = normalizeBuildVersion(buildVersion);

  if (!build) return base;
  if (base.includes('+')) return base;
  return `${base}+${build}`;
}

/** Sentry expects `dist` to be a string; anything blank must be omitted rather than sent empty. */
export function normalizeBuildVersion(
  buildVersion: string | number | undefined | null,
): string | undefined {
  if (buildVersion == null) return undefined;
  const value = String(buildVersion).trim();
  return value.length > 0 ? value : undefined;
}
