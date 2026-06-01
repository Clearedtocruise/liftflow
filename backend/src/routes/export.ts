import { Router } from 'express';
import { randomUUID } from 'node:crypto';

import { exportByType } from '../lib/pdfExport.js';

export const exportRouter = Router();

exportRouter.post('/', async (req, res) => {
  try {
    const { userId, contentType, title, sourceEntityId } = req.body as {
      userId?: string;
      contentType?: string;
      title?: string;
      sourceEntityId?: string;
    };

    if (!userId || !contentType) {
      res.status(400).json({ message: 'userId and contentType are required' });
      return;
    }

    const doc = await exportByType({
      userId,
      contentType,
      title: title ?? 'ONE MORE Export',
      sourceEntityId,
    });

    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Export failed' });
  }
});

exportRouter.post('/pdf', async (req, res) => {
  try {
    const { userId, contentType, title, sourceEntityId } = req.body as {
      userId?: string;
      contentType?: string;
      title?: string;
      sourceEntityId?: string;
    };

    if (!userId || !contentType) {
      res.status(400).json({ message: 'userId and contentType are required' });
      return;
    }

    const doc = await exportByType({
      userId,
      contentType,
      title: title ?? 'ONE MORE Export',
      sourceEntityId,
    });

    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'PDF generation failed' });
  }
});

exportRouter.post('/share', async (req, res) => {
  res.json({
    id: randomUUID(),
    token: randomUUID().replace(/-/g, ''),
    isActive: true,
    viewCount: 0,
    createdAt: new Date().toISOString(),
  });
});
