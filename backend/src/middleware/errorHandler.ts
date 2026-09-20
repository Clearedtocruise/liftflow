import type { NextFunction, Request, Response } from 'express';

import { captureException } from '../lib/sentry.js';

/** What the body parser throws before any route runs. */
type BodyParserError = { type?: string; status?: number; statusCode?: number };

/**
 * An upload bigger than the JSON limit is the caller's to fix, so it is answered rather than
 * reported: 413, with a message about the file. It used to fall through to the 500 below, which
 * told whoever was holding a twenty-megabyte program PDF that their "request entity" was "too
 * large" — accurate, and no use to them — and raised an alert on a server that was working fine.
 */
function clientBodyError(err: BodyParserError): { status: number; code: string; message: string } | null {
  if (err?.type === 'entity.too.large') {
    return {
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
      message:
        'That file is too big to read. Export the plan as text-only, print just the pages with the ' +
        'program on them, or paste the plan text instead.',
    };
  }
  if (err?.type === 'entity.parse.failed') {
    return { status: 400, code: 'MALFORMED_BODY', message: 'That request could not be read.' };
  }
  return null;
}

export function apiErrorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const client = clientBodyError(err as BodyParserError);

  if (!client) {
    captureException(err, {
      userId: req.userId,
      route: req.path,
      tags: { method: req.method },
    });
  }

  if (res.headersSent) return;

  if (client) {
    res.status(client.status).json({ message: client.message, code: client.code });
    return;
  }

  res.status(500).json({ message: err instanceof Error ? err.message : 'Internal server error' });
}
