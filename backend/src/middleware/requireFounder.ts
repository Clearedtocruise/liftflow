import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

function matchesFounderKey(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** True when the request carries the founder admin key in the x-founder-admin-key header. */
export function hasFounderKey(req: Request): boolean {
  const expected = process.env.FOUNDER_ADMIN_KEY;
  if (!expected) return false;
  return matchesFounderKey(req.headers['x-founder-admin-key'] as string | undefined, expected);
}

/**
 * Founder admin gate — set FOUNDER_ADMIN_KEY in backend env.
 * Pass via header: x-founder-admin-key. The key is never read from the query string, which
 * would persist it in access logs, Sentry breadcrumbs and browser history.
 */
export function requireFounderAdmin(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.FOUNDER_ADMIN_KEY;
  if (!expected) {
    res.status(503).json({
      message: 'Founder dashboard not configured — set FOUNDER_ADMIN_KEY on the API server',
    });
    return;
  }

  if (!hasFounderKey(req)) {
    res.status(403).json({ message: 'Founder admin access required' });
    return;
  }

  next();
}

/**
 * Gate for the founder dashboard HTML itself. A browser cannot set a custom header on a
 * top-level navigation, so the key may also arrive as ?key=… here; the page strips it from
 * the URL and re-sends it as a header for every subsequent API call.
 */
export function requireFounderAdminPage(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.FOUNDER_ADMIN_KEY;
  if (!expected) {
    res
      .status(503)
      .type('text/plain')
      .send('Founder dashboard not configured — set FOUNDER_ADMIN_KEY on the API server');
    return;
  }

  const provided =
    (req.headers['x-founder-admin-key'] as string | undefined) ?? (req.query.key as string | undefined);

  if (!matchesFounderKey(provided, expected)) {
    res.status(403).type('text/plain').send('Founder admin access required');
    return;
  }

  next();
}
