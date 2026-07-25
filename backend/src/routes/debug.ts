import { Router } from 'express';

import { captureAiError } from '../lib/aiErrorReporting.js';
import { captureTestException, flushSentry, isSentryConfigured } from '../lib/sentry.js';
import { requireFounderAdmin } from '../middleware/requireFounder.js';

/** Placeholder subject for synthetic Sentry events — never a real user's id. */
const SYNTHETIC_USER_ID = '00000000-0000-0000-0000-000000000001';

export const debugRouter = Router();

/** Non-production only — throws to exercise Express + Sentry error handler */
debugRouter.get('/debug-sentry', (_req, _res) => {
  if (process.env.NODE_ENV === 'production') {
    _res.status(404).json({ message: 'Not found' });
    return;
  }
  throw new Error('ONE MORE Sentry test exception — /debug-sentry (non-production)');
});

/** Founder-authenticated prod-safe test — captures without crashing the process */
debugRouter.post('/debug-sentry/capture', requireFounderAdmin, async (_req, res) => {
  if (!isSentryConfigured()) {
    res.status(503).json({ message: 'SENTRY_DSN not configured' });
    return;
  }

  const userId = SYNTHETIC_USER_ID;
  const eventId = captureTestException({ userId, route: '/debug-sentry/capture' });
  await flushSentry();

  res.json({
    captured: true,
    eventId: eventId ?? null,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE ?? process.env.RENDER_GIT_COMMIT ?? 'liftflow-api@1.0.0',
    userId,
  });
});

/** AI subsystem Sentry correlation test */
debugRouter.post('/debug-sentry/ai', requireFounderAdmin, async (_req, res) => {
  const userId = SYNTHETIC_USER_ID;
  const testError = new Error('ONE MORE AI route Sentry test — Sprint 8.6');
  captureAiError(testError, '/api/ai/converse', userId);
  await flushSentry();

  res.json({ captured: true, subsystem: 'ai', userId, route: '/api/ai/converse' });
});
