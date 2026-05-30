import { createClient } from '@supabase/supabase-js';
import type { NextFunction, Request, Response } from 'express';

const url = process.env.SUPABASE_URL ?? '';
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const authClient = url && anonKey ? createClient(url, anonKey) : null;

export type AuthedRequest = Request & { userId?: string };

export async function requireUser(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Authorization required' });
    return;
  }

  if (!authClient) {
    res.status(500).json({ message: 'Auth not configured on server' });
    return;
  }

  const token = header.slice(7);
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ message: 'Invalid or expired token' });
    return;
  }

  req.userId = data.user.id;
  next();
}
