import type { NextFunction, Request, Response } from 'express';

import { captureException } from '../lib/sentry.js';

export function apiErrorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const userId = (req.body as { userId?: string })?.userId ?? (req.query.userId as string | undefined);

  captureException(err, {
    userId,
    route: req.path,
    tags: { method: req.method },
  });

  const message = err instanceof Error ? err.message : 'Internal server error';
  if (!res.headersSent) {
    res.status(500).json({ message });
  }
}
