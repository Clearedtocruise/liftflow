/**
 * Sprint 8.5/8.6 — Sentry backend integration (@sentry/node v9).
 */
import type { Express } from 'express';
import * as Sentry from '@sentry/node';
import { expressIntegration, setupExpressErrorHandler } from '@sentry/node';

let initialized = false;

export function isSentryConfigured(): boolean {
  return Boolean(process.env.SENTRY_DSN);
}

export function getSentryRelease(): string {
  return process.env.SENTRY_RELEASE ?? process.env.RENDER_GIT_COMMIT ?? 'liftflow-api@1.0.0';
}

export function getSentryEnvironment(): string {
  return process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development';
}

export function initSentry(): void {
  if (initialized) return;
  initialized = true;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.log('Sentry: SENTRY_DSN not set — error tracking disabled');
    return;
  }

  Sentry.init({
    dsn,
    environment: getSentryEnvironment(),
    release: getSentryRelease(),
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    integrations: [expressIntegration()],
  });

  console.log(`Sentry: backend error tracking enabled (${getSentryEnvironment()} / ${getSentryRelease()})`);
}

export function setupSentryExpressErrorHandler(app: Express): void {
  if (!isSentryConfigured()) return;
  setupExpressErrorHandler(app);
}

export function captureException(
  error: unknown,
  context?: { userId?: string; route?: string; tags?: Record<string, string> },
): string | undefined {
  if (!isSentryConfigured()) return undefined;

  return Sentry.withScope((scope) => {
    if (context?.userId) scope.setUser({ id: context.userId });
    if (context?.route) scope.setTag('route', context.route);
    if (context?.tags) {
      for (const [k, v] of Object.entries(context.tags)) scope.setTag(k, v);
    }
    return Sentry.captureException(error);
  });
}

export function captureTestException(context?: {
  userId?: string;
  route?: string;
  tags?: Record<string, string>;
}): string | undefined {
  const error = new Error('LiftFlow Sentry test exception — Sprint 8.6');
  error.name = 'SentryTestError';
  return captureException(error, {
    userId: context?.userId ?? '00000000-0000-0000-0000-000000000001',
    route: context?.route ?? '/debug-sentry',
    tags: { ...context?.tags, test: 'true', source: 'sprint86' },
  });
}

export async function flushSentry(timeoutMs = 2000): Promise<boolean> {
  if (!isSentryConfigured()) return false;
  return Sentry.flush(timeoutMs);
}

export function setSentryUser(userId: string | null): void {
  if (!isSentryConfigured()) return;
  Sentry.setUser(userId ? { id: userId } : null);
}

/** @deprecated Use setupSentryExpressErrorHandler(app) after routes */
export function getSentryRequestHandler(): unknown {
  return (_req: unknown, _res: unknown, next: () => void) => next();
}

/** @deprecated Use setupSentryExpressErrorHandler(app) after routes */
export function getSentryErrorHandler(): unknown {
  return (err: unknown, _req: unknown, _res: unknown, next: (e?: unknown) => void) => next(err);
}

export { Sentry };
