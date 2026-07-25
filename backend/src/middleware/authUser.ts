import { createClient } from '@supabase/supabase-js';
import type { NextFunction, Request, Response } from 'express';

const url = process.env.SUPABASE_URL ?? '';
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const authClient = url && anonKey ? createClient(url, anonKey) : null;

declare global {
  namespace Express {
    interface Request {
      /** Set only by requireUser/optionalUser from a verified Supabase JWT — never from a client payload. */
      userId?: string;
    }
  }
}

export type AuthedRequest = Request & { userId?: string };

function bearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice(7).trim() || undefined;
}

async function verifyToken(token: string): Promise<string | null> {
  if (!authClient) return null;
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

export async function requireUser(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ message: 'Authorization required' });
    return;
  }

  if (!authClient) {
    res.status(500).json({ message: 'Auth not configured on server' });
    return;
  }

  const userId = await verifyToken(token);
  if (!userId) {
    res.status(401).json({ message: 'Invalid or expired token' });
    return;
  }

  req.userId = userId;
  next();
}

/**
 * Attaches req.userId when a valid bearer token is present, otherwise leaves it unset.
 * For endpoints that legitimately accept anonymous traffic (telemetry, feedback) but must
 * never attribute an event to a user id supplied in the request payload.
 */
export async function optionalUser(req: AuthedRequest, _res: Response, next: NextFunction) {
  const token = bearerToken(req);
  if (token) {
    req.userId = (await verifyToken(token)) ?? undefined;
  }
  next();
}

/** The caller's verified identity. Throws if the route was mounted without requireUser. */
export function authedUserId(req: AuthedRequest): string {
  if (!req.userId) throw new Error('Route is missing requireUser — no verified user on request');
  return req.userId;
}
