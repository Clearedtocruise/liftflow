import type { NextFunction, Request, Response } from 'express';

/**
 * Founder admin gate — set FOUNDER_ADMIN_KEY in backend env.
 * Pass via header: x-founder-admin-key
 */
export function requireFounderAdmin(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.FOUNDER_ADMIN_KEY;
  if (!expected) {
    res.status(503).json({
      message: 'Founder dashboard not configured — set FOUNDER_ADMIN_KEY on the API server',
    });
    return;
  }

  const provided =
    (req.headers['x-founder-admin-key'] as string | undefined) ??
    (req.query.key as string | undefined);

  if (!provided || provided !== expected) {
    res.status(403).json({ message: 'Founder admin access required' });
    return;
  }

  next();
}
