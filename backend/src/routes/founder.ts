import { Router } from 'express';

import { getMonitoringSnapshot, getProductMetrics } from '../lib/betaMetrics.js';
import { getFeedbackSummary } from '../lib/feedback.js';
import { getFounderDashboardData } from '../lib/founderDashboard.js';
import { FOUNDER_DASHBOARD_HTML } from '../lib/founderDashboardHtml.js';
import { runOutcomeEngineForAllUsers } from '../lib/outcomeEngine.js';
import { requireFounderAdmin } from '../middleware/requireFounder.js';

export const founderRouter = Router();

founderRouter.get('/dashboard', requireFounderAdmin, async (_req, res) => {
  try {
    const [dashboard, productMetrics, monitoring, feedbackSummary] = await Promise.all([
      getFounderDashboardData(),
      getProductMetrics().catch(() => null),
      getMonitoringSnapshot(),
      getFeedbackSummary().catch(() => null),
    ]);
    res.json({
      ...dashboard,
      betaOps: { productMetrics, monitoring, feedbackSummary },
    });
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
