import { Router } from 'express';

import {
    computeUserOutcome,
    getUserOutcomeSummary,
    runOutcomeEngineForAllUsers,
} from '../lib/outcomeEngine.js';
import { requireUser, type AuthedRequest } from '../middleware/authUser.js';
import { requireFounderAdmin } from '../middleware/requireFounder.js';

export const outcomeRouter = Router();

/** Cron / founder: recompute all onboarded users + population aggregates */
outcomeRouter.post('/compute', requireFounderAdmin, async (_req, res) => {
  try {
    const result = await runOutcomeEngineForAllUsers();
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Outcome compute failed' });
  }
});

/** Founder or service: compute single user */
outcomeRouter.post('/compute/:userId', requireFounderAdmin, async (req, res) => {
  try {
    const userId = String(req.params.userId);
    const period = req.query.period === 'daily' ? 'daily' : 'weekly';
    const result = await computeUserOutcome(userId, period);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'User outcome compute failed' });
  }
});

/** Authenticated user reads own outcome summary */
outcomeRouter.get('/user/me', requireUser, async (req: AuthedRequest, res) => {
  try {
    if (!req.userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    res.json(await getUserOutcomeSummary(req.userId));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Outcome fetch failed' });
  }
});

/** Founder reads any user */
outcomeRouter.get('/user/:userId', requireFounderAdmin, async (req, res) => {
  try {
    res.json(await getUserOutcomeSummary(String(req.params.userId)));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Outcome fetch failed' });
  }
});
