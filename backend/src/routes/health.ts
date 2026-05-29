import { Router } from 'express';

import { hasOpenAI } from '../lib/openai.js';
import { supabaseAdmin } from '../lib/supabase.js';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'liftflow-api',
    openai: hasOpenAI() ? 'configured' : 'missing',
    supabase: supabaseAdmin ? 'configured' : 'missing',
    timestamp: new Date().toISOString(),
  });
});
