import { Router } from 'express';

import { assessRecovery, suggestMuscleGroups } from '../lib/aiCoach.js';

export const trainingRouter = Router();

trainingRouter.get('/suggest-muscles', async (req, res) => {
  try {
    const userId = req.query.userId as string | undefined;
    if (!userId) {
      res.status(400).json({ message: 'userId query param required' });
      return;
    }
    res.json(await suggestMuscleGroups(userId));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Suggest muscles failed' });
  }
});

trainingRouter.get('/recovery', async (req, res) => {
  try {
    const userId = req.query.userId as string | undefined;
    if (!userId) {
      res.status(400).json({ message: 'userId query param required' });
      return;
    }
    res.json(await assessRecovery(userId));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Recovery assessment failed' });
  }
});
