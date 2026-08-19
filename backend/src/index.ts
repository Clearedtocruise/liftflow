import cors from 'cors';
import express from 'express';
import './loadEnv.js';

import { hasOpenAI } from './lib/openai.js';
import { initSentry, setupSentryExpressErrorHandler } from './lib/sentry.js';
import { supabaseAdmin } from './lib/supabase.js';
import { optionalUser, requireUser } from './middleware/authUser.js';
import { apiErrorHandler } from './middleware/errorHandler.js';
import { requireFounderAdminPage } from './middleware/requireFounder.js';
import { aiLimiter, allowedOrigins, corsOptions, globalLimiter, voiceLimiter } from './middleware/security.js';
import { aiRouter } from './routes/ai.js';
import { analyticsRouter } from './routes/analytics.js';
import { authRouter } from './routes/auth.js';
import { betaRouter } from './routes/beta.js';
import { bodyRouter } from './routes/body.js';
import { cardioRouter } from './routes/cardio.js';
import { debugRouter } from './routes/debug.js';
import { eventsRouter } from './routes/events.js';
import { exportRouter } from './routes/export.js';
import { feedbackRouter } from './routes/feedback.js';
import { founderRouter, serveFounderDashboard } from './routes/founder.js';
import { goalsRouter } from './routes/goals.js';
import { healthRouter } from './routes/health.js';
import { integrationsRouter } from './routes/integrations.js';
import { legalRouter } from './routes/legal.js';
import { nutritionRouter } from './routes/nutrition.js';
import { outcomeRouter } from './routes/outcome.js';
import { parseRouter } from './routes/parse.js';
import { adsRouter, notificationsRouter, subscriptionsRouter } from './routes/platform.js';
import { trainingRouter } from './routes/training.js';
import { userRouter } from './routes/user.js';
import { voiceRouter } from './routes/voice.js';
import { watchRouter } from './routes/watch.js';
import { weeklyRouter } from './routes/weekly.js';
import { workoutsRouter } from './routes/workouts.js';

const app = express();
const PORT = process.env.PORT ?? 3000;

initSentry();

// Render terminates TLS in front of the app; without this the client IP seen by the rate
// limiter is the proxy's, which would put every caller in one bucket.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Health checks should be as lightweight as possible and must not depend on auth/rate limits.
app.use('/health', healthRouter);

app.use(cors(corsOptions));
app.use(express.json({ limit: '12mb' }));
app.use(globalLimiter);

app.use(debugRouter);
app.use('/auth', authRouter);
app.use('/legal', legalRouter);

// Legacy parse route (redirect to voice) — shares the voice budget, not the coach/LLM budget.
app.use('/api/parse', requireUser, voiceLimiter, parseRouter);

// Authenticated domain routes. requireUser is mounted here rather than per-handler so a new
// route in any of these files cannot be added without authentication.
app.use('/api/voice', requireUser, voiceLimiter, voiceRouter);
app.use('/api/watch', requireUser, watchRouter);
app.use('/api/ai', requireUser, aiLimiter, aiRouter);
app.use('/api/workouts', requireUser, workoutsRouter);
app.use('/api/training', requireUser, trainingRouter);
app.use('/api/weekly', requireUser, weeklyRouter);
app.use('/api/nutrition', requireUser, nutritionRouter);
app.use('/api/body', requireUser, aiLimiter, bodyRouter);
app.use('/api/analytics', requireUser, analyticsRouter);
app.use('/api/goals', requireUser, goalsRouter);
app.use('/api/cardio', requireUser, cardioRouter);
app.use('/api/subscriptions', requireUser, subscriptionsRouter);
app.use('/api/ads', requireUser, adsRouter);
app.use('/api/notifications', requireUser, notificationsRouter);
app.use('/api/export', requireUser, exportRouter);
app.use('/api/user', requireUser, userRouter);

// Mixed routers: gate per-route because they also expose OAuth callbacks, founder-only
// endpoints, or endpoints that legitimately accept anonymous traffic.
app.use('/api/integrations', integrationsRouter);
app.use('/api/outcome', outcomeRouter);
app.use('/api/founder', founderRouter);
app.use('/api/feedback', optionalUser, feedbackRouter);
app.use('/api/events', optionalUser, eventsRouter);
app.use('/api/beta', optionalUser, betaRouter);

app.get('/admin/founder', requireFounderAdminPage, serveFounderDashboard);

setupSentryExpressErrorHandler(app);
app.use(apiErrorHandler);

app.listen(PORT, () => {
  console.log(`ONE MORE API listening on port ${PORT}`);
  console.log(`OpenAI: ${hasOpenAI() ? 'configured' : 'NOT SET — AI routes use fallbacks'}`);
  console.log(`Supabase admin: ${supabaseAdmin ? 'configured' : 'NOT SET — body/export routes may fail'}`);
  console.log('Routes: /health, /api/voice, /api/ai, /api/workouts, /api/training,');
  console.log('        /api/nutrition, /api/body, /api/analytics, /api/goals,');
  console.log('        /api/integrations, /api/cardio, /api/subscriptions, /api/export');
  console.log('        /api/outcome, /api/founder, /admin/founder');
  console.log('        /api/feedback, /api/events, /api/beta');
  console.log(`Sentry: ${process.env.SENTRY_DSN ? 'configured' : 'NOT SET'}`);
  console.log(`CORS allowlist: ${allowedOrigins().join(', ')}`);
});
