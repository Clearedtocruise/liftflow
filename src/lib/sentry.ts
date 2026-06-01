import Constants from 'expo-constants';
import { Platform } from 'react-native';

import * as Sentry from '@sentry/react-native';

let initialized = false;

function release(): string {
  return process.env.EXPO_PUBLIC_SENTRY_RELEASE ?? `liftflow@${Constants.expoConfig?.version ?? '1.0.0'}`;
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
  };
}

export { Sentry };
