import { Router } from 'express';

import { weekStartDateString } from '../lib/localDate.js';
import {
    acceptWeeklyCloseout,
    buildWeeklyCloseoutSummary,
    getWeeklyCloseoutStatus,
    prepareWeeklyCloseout,
} from '../lib/weeklyCloseoutEngine.js';
import { authedUserId } from '../middleware/authUser.js';

export const weeklyRouter = Router();

weeklyRouter.get('/summary', async (req, res) => {
  try {
    const userId = authedUserId(req);
    const weekStart = (req.query.weekStart as string | undefined) ?? weekStartDateString(new Date().toISOString().slice(0, 10));
    const summary = await buildWeeklyCloseoutSummary(userId, weekStart);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Weekly summary failed' });
  }
});

weeklyRouter.get('/closeout/status', async (req, res) => {
  try {
    const userId = authedUserId(req);
    const weekStart = req.query.weekStart as string | undefined;
    const record = await getWeeklyCloseoutStatus(userId, weekStart);
    res.json(record);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Closeout status failed' });
  }
});

weeklyRouter.post('/closeout/prepare', async (req, res) => {
  try {
    const userId = authedUserId(req);
    const { referenceDate } = req.body as { referenceDate?: string };
    const record = await prepareWeeklyCloseout(userId, referenceDate);
    res.json(record);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Prepare closeout failed' });
  }
});

weeklyRouter.post('/closeout/accept', async (req, res) => {
  try {
    const userId = authedUserId(req);
    const { closeoutId } = req.body as { closeoutId?: string };
    if (!closeoutId) {
      res.status(400).json({ message: 'closeoutId is required' });
      return;
    }
    const record = await acceptWeeklyCloseout(userId, closeoutId);
    res.json(record);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Accept closeout failed' });
  }
});
