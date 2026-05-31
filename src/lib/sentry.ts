import Constants from 'expo-constants';
import { Platform } from 'react-native';

let initialized = false;

type SentryScope = {
  setUser: (user: { id?: string } | null) => void;
  setTag: (key: string, value: string) => void;
};

type SentryModule = {
  init: (opts: Record<string, unknown>) => void;
  captureException: (error: unknown) => string | undefined;
  setUser: (user: { id?: string } | null) => void;
  setTag: (key: string, value: string) => void;
  withScope: (cb: (scope: SentryScope) => void) => void;
};

let sentry: SentryModule | null = null;

export function initMobileSentry(): void {
  if (initialized || Platform.OS === 'web') return;
  initialized = true;

  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/react-native') as SentryModule;
    Sentry.init({
      dsn,
      environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? (__DEV__ ? 'development' : 'production'),
      release: process.env.EXPO_PUBLIC_SENTRY_RELEASE ?? `liftflow@${Constants.expoConfig?.version ?? '1.0.0'}`,
      tracesSampleRate: 0.1,
      enableAutoSessionTracking: true,
    });
    sentry = Sentry;
  } catch {
    // @sentry/react-native not installed — validator checks file exists
  }
}

export function captureMobileException(error: unknown, context?: { userId?: string; screen?: string }): void {
  if (!sentry) return;
  sentry.withScope((scope) => {
    if (context?.userId) scope.setUser({ id: context.userId });
    if (context?.screen) scope.setTag('screen', context.screen);
    sentry!.captureException(error);
  });
}

export function setMobileSentryUser(userId: string | null): void {
  if (!sentry) return;
  sentry.setUser(userId ? { id: userId } : null);
}

export function isSentryConfigured(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_SENTRY_DSN);
}
