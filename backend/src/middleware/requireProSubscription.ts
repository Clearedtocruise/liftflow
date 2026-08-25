import type { NextFunction, Response } from 'express';

import { hasPremiumProfileAccess } from '../lib/premiumAccessOverride.js';
import { BASIC_MIN_RANK, PRO_MIN_RANK, subscriptionMeetsRank } from '../lib/subscriptionTiers.js';
import { requireAdmin } from '../lib/supabase.js';
import type { AuthedRequest } from './authUser.js';

type ProRequest = AuthedRequest;

/**
 * Tier-aware subscription gate. `minRank` is BASIC_MIN_RANK for Basic-and-above routes (e.g. custom
 * programs) or PRO_MIN_RANK for Pro-only routes (e.g. AI coach). Ranking keeps the gates monotonic:
 * a Pro subscriber passes a Basic route, but a Basic subscriber never passes a Pro route.
 *
 * Must be chained after requireUser: identity comes only from the verified token, so the paywall can
 * never be evaluated against a UUID supplied in the query string or body.
 */
function requireSubscriptionRank(minRank: number, code: 'PRO_REQUIRED' | 'BASIC_REQUIRED', message: string) {
  return async function gate(req: ProRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ message: 'Authorization required', code: 'UNAUTHENTICATED' });
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

      const { data, error } = await db
        .from('subscriptions')
        .select('tier, status, current_period_end')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      if (!subscriptionMeetsRank(data ?? null, minRank)) {
        res.status(403).json({ message, code });
        return;
      }

      next();
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Subscription check failed' });
    }
  };
}

/** Blocks Pro-only API routes (AI, recovery, nutrition intelligence, …) below the Pro tier. */
export const requireProSubscription = requireSubscriptionRank(PRO_MIN_RANK, 'PRO_REQUIRED', 'ONE MORE Pro subscription required');

/** Blocks Basic-and-above routes (custom programs, looping) for free/expired users. Pro passes too. */
export const requireBasicSubscription = requireSubscriptionRank(BASIC_MIN_RANK, 'BASIC_REQUIRED', 'ONE MORE Basic subscription required');
