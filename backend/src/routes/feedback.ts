import { Router } from 'express';

import { getFeedbackSummary, listFeedback, submitFeedback, updateFeedbackStatus } from '../lib/feedback.js';
import { requireFounderAdmin } from '../middleware/requireFounder.js';
import { captureException } from '../lib/sentry.js';

export const feedbackRouter = Router();

feedbackRouter.post('/submit', async (req, res) => {
  try {
    const {
      userId,
      feedbackType,
      subject,
      body,
      screenshotUrl,
      deviceMetadata,
      appVersion,
      appEnvironment,
      area,
      issueCategory,
    } = req.body as {
      userId?: string;
      feedbackType?: 'bug' | 'feature' | 'support' | 'confusion';
      subject?: string;
      body?: string;
      screenshotUrl?: string;
      deviceMetadata?: Record<string, unknown>;
      appVersion?: string;
      appEnvironment?: string;
      area?: string;
      issueCategory?: 'crash' | 'confusion' | 'missing_feature' | 'feature_request' | 'support' | 'other';
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
      area,
      issueCategory,
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

feedbackRouter.get('/list', requireFounderAdmin, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    res.json({ items: await listFeedback(limit) });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'List failed' });
  }
});

feedbackRouter.patch('/:id/status', requireFounderAdmin, async (req, res) => {
  try {
    const { status } = req.body as { status?: 'open' | 'triaged' | 'resolved' | 'closed' };
    if (!status) {
      res.status(400).json({ message: 'status is required' });
      return;
    }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      res.status(400).json({ message: 'id is required' });
      return;
    }
    res.json(await updateFeedbackStatus(id, status));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Status update failed' });
  }
});
