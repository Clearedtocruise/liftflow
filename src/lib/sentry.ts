import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import * as Sentry from '@sentry/react-native';

import { formatSentryRelease, normalizeBuildVersion } from '@/lib/sentryRelease';

let initialized = false;

/** iOS CFBundleVersion — the build number EAS assigns, not the stale value in app config. */
function buildVersion(): string | undefined {
  return normalizeBuildVersion(Application.nativeBuildVersion);
}

function release(): string {
  const base =
    process.env.EXPO_PUBLIC_SENTRY_RELEASE ??
    `liftflow@${Constants.expoConfig?.version ?? '1.0.0'}`;
  return formatSentryRelease(base, buildVersion());
}

function environment(): string {
  return process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? (__DEV__ ? 'development' : 'production');
}

export function initMobileSentry(): void {
  if (initialized || Platform.OS === 'web') return;

  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: environment(),
    release: release(),
    tracesSampleRate: 0.1,
    enableAutoSessionTracking: true,
    enableNative: true,
    enableNativeCrashHandling: true,
    // Sentry resolves issues against release+dist, so without this a fix shipped in a new build
    // never marked the old issue resolved.
    dist: buildVersion(),
  });

  initialized = true;
}

export function isMobileSentryReady(): boolean {
  return initialized && Boolean(process.env.EXPO_PUBLIC_SENTRY_DSN);
}

export function captureMobileException(error: unknown, context?: { userId?: string; screen?: string }): string | undefined {
  if (!initialized) return undefined;
  return Sentry.withScope((scope) => {
    if (context?.userId) scope.setUser({ id: context.userId });
    if (context?.screen) scope.setTag('screen', context.screen);
    scope.setTag('platform', Platform.OS);
    return Sentry.captureException(error);
  });
}

export function captureMobileTestException(userId?: string): string | undefined {
  const error = new Error('ONE MORE mobile Sentry test exception — Sprint 8.6');
  error.name = 'MobileSentryTestError';
  return captureMobileException(error, { userId, screen: 'sentry-test' });
}

export function setMobileSentryUser(userId: string | null): void {
  if (!initialized) return;
  Sentry.setUser(userId ? { id: userId } : null);
}

export function isSentryConfigured(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_SENTRY_DSN);
}

export function getMobileSentryConfig() {
  return {
    configured: isSentryConfigured(),
    ready: isMobileSentryReady(),
    environment: environment(),
    release: release(),
    dist: buildVersion(),
  };
}

export { Sentry };
