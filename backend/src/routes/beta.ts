import { Router } from 'express';

import { getMonitoringSnapshot, getProductMetrics } from '../lib/betaMetrics.js';
import { listChangelog, listReleaseNotes, redeemBetaInvite } from '../lib/betaOps.js';
import { captureException } from '../lib/sentry.js';
import { requireFounderAdmin } from '../middleware/requireFounder.js';

export const betaRouter = Router();

betaRouter.post('/invite/redeem', async (req, res) => {
  try {
    const { userId, code } = req.body as { userId?: string; code?: string };
    if (!userId || !code?.trim()) {
      res.status(400).json({ message: 'userId and code are required' });
      return;
    }
    res.json(await redeemBetaInvite(userId, code));
  } catch (error) {
    captureException(error, { userId: req.body?.userId, route: '/api/beta/invite/redeem' });
    res.status(400).json({ message: error instanceof Error ? error.message : 'Redeem failed' });
  }
});

betaRouter.get('/release-notes', async (_req, res) => {
  try {
    res.json({ notes: await listReleaseNotes() });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Fetch failed' });
  }
});

betaRouter.get('/changelog', async (_req, res) => {
  try {
    res.json({ entries: await listChangelog() });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Fetch failed' });
  }
});

betaRouter.get('/metrics', requireFounderAdmin, async (_req, res) => {
  try {
    res.json(await getProductMetrics());
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Metrics failed' });
  }
});

betaRouter.get('/monitoring', requireFounderAdmin, async (_req, res) => {
  try {
    res.json(await getMonitoringSnapshot());
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Monitoring failed' });
  }
});
