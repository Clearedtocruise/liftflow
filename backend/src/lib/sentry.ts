/**
 * Sprint 8.5 — Optional Sentry backend integration (no-op when SENTRY_DSN unset).
 */

type SentryLike = {
  init: (opts: Record<string, unknown>) => void;
  captureException: (err: unknown, ctx?: Record<string, unknown>) => string | undefined;
  setUser: (user: { id?: string; email?: string } | null) => void;
  setTag: (key: string, value: string) => void;
  setContext: (name: string, ctx: Record<string, unknown>) => void;
  Handlers?: {
    requestHandler: () => unknown;
    errorHandler: () => unknown;
  };
};

let sentry: SentryLike | null = null;
let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  initialized = true;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.log('Sentry: SENTRY_DSN not set — error tracking disabled');
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/node') as SentryLike;
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
      release: process.env.SENTRY_RELEASE ?? process.env.RENDER_GIT_COMMIT ?? 'liftflow-api@dev',
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    });
    sentry = Sentry;
    console.log('Sentry: backend error tracking enabled');
  } catch {
    console.warn('Sentry: @sentry/node not installed — run npm install in backend/');
  }
}

export function captureException(
  error: unknown,
  context?: { userId?: string; route?: string; tags?: Record<string, string> },
): void {
  if (!sentry) return;
  if (context?.userId) sentry.setUser({ id: context.userId });
  if (context?.route) sentry.setTag('route', context.route);
  if (context?.tags) {
    for (const [k, v] of Object.entries(context.tags)) sentry.setTag(k, v);
  }
  sentry.captureException(error);
}

export function setSentryUser(userId: string | null): void {
  if (!sentry) return;
  sentry.setUser(userId ? { id: userId } : null);
}

export function getSentryRequestHandler(): unknown {
  return sentry?.Handlers?.requestHandler?.() ?? ((_req: unknown, _res: unknown, next: () => void) => next());
}

export function getSentryErrorHandler(): unknown {
  return (
    sentry?.Handlers?.errorHandler?.() ??
    ((err: unknown, _req: unknown, _res: unknown, next: (e?: unknown) => void) => next(err))
  );
}
