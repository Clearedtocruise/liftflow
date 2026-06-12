import type { NextFunction, Response } from 'express';

import { hasPremiumProfileAccess } from '../lib/premiumAccessOverride.js';
import { requireAdmin } from '../lib/supabase.js';
import type { AuthedRequest } from './authUser.js';

type ProRequest = AuthedRequest & {
  query?: { userId?: string };
  body?: { userId?: string };
};

function getUserId(req: ProRequest): string | undefined {
  return req.userId ?? req.body?.userId ?? (req.query?.userId as string | undefined);
}

function isProTier(row: { tier?: string; status?: string; current_period_end?: string | null } | null): boolean {
  if (!row || row.tier === 'free') return false;
  if (row.status === 'active' || row.status === 'trialing') return true;
  if (row.status === 'cancelled' && row.current_period_end) {
    return new Date(row.current_period_end) > new Date();
  }
  return false;
}

/** Blocks Pro-only API routes when subscription is free/expired. */
export async function requireProSubscription(req: ProRequest, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(400).json({ message: 'userId is required', code: 'USER_ID_REQUIRED' });
      return;
    }

    if (process.env.SUBSCRIPTION_GATE_DISABLED === '1') {
      next();
      return;
    }

    const db = requireAdmin();

    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('email, is_beta_tester')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (hasPremiumProfileAccess(profile)) {
      next();
      return;
    }

    const { data, error } = await db.from('subscriptions').select('tier, status, current_period_end').eq('user_id', userId).maybeSingle();

    if (error) throw error;
    if (!isProTier(data)) {
      res.status(403).json({
        message: 'LiftFlow Pro subscription required',
        code: 'PRO_REQUIRED',
      });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Subscription check failed' });
  }
}
