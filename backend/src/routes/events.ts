import { Router } from 'express';

import { trackAppEvent } from '../lib/betaMetrics.js';
import { captureException } from '../lib/sentry.js';

export const eventsRouter = Router();

eventsRouter.post('/track', async (req, res) => {
  try {
    const { userId, sessionId, eventName, properties, appVersion, appEnvironment, platform } = req.body as {
      userId?: string;
      sessionId?: string;
      eventName?: string;
      properties?: Record<string, unknown>;
      appVersion?: string;
      appEnvironment?: string;
      platform?: string;
    };

    if (!eventName?.trim()) {
      res.status(400).json({ message: 'eventName is required' });
      return;
    }

    const row = await trackAppEvent({
      userId,
      sessionId,
      eventName: eventName.trim(),
      properties,
      appVersion,
      appEnvironment,
      platform,
    });

    res.json({ id: row.id, tracked: true });
  } catch (error) {
    captureException(error, { userId: req.body?.userId, route: '/api/events/track' });
    res.status(500).json({ message: error instanceof Error ? error.message : 'Track failed' });
  }
});
