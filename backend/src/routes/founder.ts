import { Router } from 'express';

import { getFounderDashboardData } from '../lib/founderDashboard.js';
import { FOUNDER_DASHBOARD_HTML } from '../lib/founderDashboardHtml.js';
import { runOutcomeEngineForAllUsers } from '../lib/outcomeEngine.js';
import { requireFounderAdmin } from '../middleware/requireFounder.js';

export const founderRouter = Router();

founderRouter.get('/dashboard', requireFounderAdmin, async (_req, res) => {
  try {
    res.json(await getFounderDashboardData());
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Founder dashboard failed' });
  }
});

founderRouter.post('/refresh', requireFounderAdmin, async (_req, res) => {
  try {
    const compute = await runOutcomeEngineForAllUsers();
    const dashboard = await getFounderDashboardData();
    res.json({ compute, dashboard });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Founder refresh failed' });
  }
});

export function serveFounderDashboard(_req: unknown, res: { type: (t: string) => { send: (b: string) => void } }) {
  res.type('html').send(FOUNDER_DASHBOARD_HTML);
}
