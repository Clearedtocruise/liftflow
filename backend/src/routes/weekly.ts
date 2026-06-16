import { Router } from 'express';

import { weekStartDateString } from '../lib/localDate.js';
import {
    acceptWeeklyCloseout,
    buildWeeklyCloseoutSummary,
    getWeeklyCloseoutStatus,
    prepareWeeklyCloseout,
} from '../lib/weeklyCloseoutEngine.js';

export const weeklyRouter = Router();

weeklyRouter.get('/summary', async (req, res) => {
  try {
    const userId = req.query.userId as string | undefined;
    const weekStart = (req.query.weekStart as string | undefined) ?? weekStartDateString(new Date().toISOString().slice(0, 10));
    if (!userId) {
      res.status(400).json({ message: 'userId is required' });
      return;
    }
    const summary = await buildWeeklyCloseoutSummary(userId, weekStart);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Weekly summary failed' });
  }
});

weeklyRouter.get('/closeout/status', async (req, res) => {
  try {
    const userId = req.query.userId as string | undefined;
    const weekStart = req.query.weekStart as string | undefined;
    if (!userId) {
      res.status(400).json({ message: 'userId is required' });
      return;
    }
    const record = await getWeeklyCloseoutStatus(userId, weekStart);
    res.json(record);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Closeout status failed' });
  }
});

weeklyRouter.post('/closeout/prepare', async (req, res) => {
  try {
    const { userId, referenceDate } = req.body as { userId?: string; referenceDate?: string };
    if (!userId) {
      res.status(400).json({ message: 'userId is required' });
      return;
    }
    const record = await prepareWeeklyCloseout(userId, referenceDate);
    res.json(record);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Prepare closeout failed' });
  }
});

weeklyRouter.post('/closeout/accept', async (req, res) => {
  try {
    const { userId, closeoutId } = req.body as { userId?: string; closeoutId?: string };
    if (!userId || !closeoutId) {
      res.status(400).json({ message: 'userId and closeoutId are required' });
      return;
    }
    const record = await acceptWeeklyCloseout(userId, closeoutId);
    res.json(record);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Accept closeout failed' });
  }
});
