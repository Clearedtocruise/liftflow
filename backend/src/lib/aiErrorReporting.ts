import { captureException } from '../lib/sentry.js';

/** Report AI route failures to Sentry with user correlation. */
export function captureAiError(error: unknown, route: string, userId?: string): void {
  captureException(error, {
    userId,
    route,
    tags: { subsystem: 'ai' },
  });
}
