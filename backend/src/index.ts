import cors from 'cors';
import express from 'express';
import './loadEnv.js';

import { hasOpenAI } from './lib/openai.js';
import { supabaseAdmin } from './lib/supabase.js';
import { aiRouter } from './routes/ai.js';
import { analyticsRouter } from './routes/analytics.js';
import { bodyRouter } from './routes/body.js';
import { cardioRouter } from './routes/cardio.js';
import { exportRouter } from './routes/export.js';
import { goalsRouter } from './routes/goals.js';
import { healthRouter } from './routes/health.js';
import { integrationsRouter } from './routes/integrations.js';
import { legalRouter } from './routes/legal.js';
import { nutritionRouter } from './routes/nutrition.js';
import { parseRouter } from './routes/parse.js';
import { adsRouter, notificationsRouter, subscriptionsRouter } from './routes/platform.js';
import { trainingRouter } from './routes/training.js';
import { userRouter } from './routes/user.js';
import { voiceRouter } from './routes/voice.js';
import { workoutsRouter } from './routes/workouts.js';

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health
app.use('/health', healthRouter);
app.use('/legal', legalRouter);

// Legacy parse route (redirect to voice)
app.use('/api/parse', parseRouter);

// Domain routes — all scaffolded with 501 placeholders
app.use('/api/voice', voiceRouter);
app.use('/api/ai', aiRouter);
app.use('/api/workouts', workoutsRouter);
app.use('/api/training', trainingRouter);
app.use('/api/nutrition', nutritionRouter);
app.use('/api/body', bodyRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/goals', goalsRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/api/cardio', cardioRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/ads', adsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/export', exportRouter);
app.use('/api/user', userRouter);

app.listen(PORT, () => {
  console.log(`LiftFlow API listening on port ${PORT}`);
  console.log(`OpenAI: ${hasOpenAI() ? 'configured' : 'NOT SET — AI routes use fallbacks'}`);
  console.log(`Supabase admin: ${supabaseAdmin ? 'configured' : 'NOT SET — body/export routes may fail'}`);
  console.log('Routes: /health, /api/voice, /api/ai, /api/workouts, /api/training,');
  console.log('        /api/nutrition, /api/body, /api/analytics, /api/goals,');
  console.log('        /api/integrations, /api/cardio, /api/subscriptions, /api/export');
});
