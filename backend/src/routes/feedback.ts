import { Router } from 'express';

import { getFeedbackSummary, submitFeedback } from '../lib/feedback.js';
import { captureException } from '../lib/sentry.js';

export const feedbackRouter = Router();

feedbackRouter.post('/submit', async (req, res) => {
  try {
    const { userId, feedbackType, subject, body, screenshotUrl, deviceMetadata, appVersion, appEnvironment } =
      req.body as {
        userId?: string;
        feedbackType?: 'bug' | 'feature' | 'support';
        subject?: string;
        body?: string;
        screenshotUrl?: string;
        deviceMetadata?: Record<string, unknown>;
        appVersion?: string;
        appEnvironment?: string;
      };

    if (!feedbackType || !subject?.trim() || !body?.trim()) {
      res.status(400).json({ message: 'feedbackType, subject, and body are required' });
      return;
    }

    const row = await submitFeedback({
      userId,
      feedbackType,
      subject: subject.trim(),
      body: body.trim(),
      screenshotUrl,
      deviceMetadata,
      appVersion,
      appEnvironment,
    });

    res.json({ id: row.id, createdAt: row.created_at, message: 'Feedback received — thank you' });
  } catch (error) {
    captureException(error, { userId: req.body?.userId, route: '/api/feedback/submit' });
    res.status(500).json({ message: error instanceof Error ? error.message : 'Feedback submit failed' });
  }
});

feedbackRouter.get('/summary', async (_req, res) => {
  try {
    res.json(await getFeedbackSummary());
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Summary failed' });
  }
});
