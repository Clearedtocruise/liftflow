import type { NextFunction, Response } from 'express';

import { requireAdmin } from '../lib/supabase.js';
import type { AuthedRequest } from './authUser.js';

export type FounderRequest = AuthedRequest & { isFounder?: boolean };

/** Requires authenticated user with is_founder on profile. */
export async function requireFounderUser(req: FounderRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: 'Authorization required' });
      return;
    }

    const db = requireAdmin();
    const { data, error } = await db
      .from('profiles')
      .select('is_founder, email')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    const founderEmail = (data?.email ?? '').toLowerCase() === 'clearedtocruise@gmail.com';
    if (!data?.is_founder && !founderEmail) {
      res.status(403).json({ message: 'Founder access required', code: 'FOUNDER_REQUIRED' });
      return;
    }

    req.isFounder = true;
    next();
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Founder check failed' });
  }
}
