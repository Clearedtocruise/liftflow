import { Router } from 'express';

import { requireAdmin } from '../lib/supabase.js';
import type { AuthedRequest } from '../middleware/authUser.js';
import { requireUser } from '../middleware/authUser.js';
import { notImplemented } from '../middleware/placeholder.js';

export const subscriptionsRouter = Router();

function mapSubscription(row: Record<string, unknown>) {
  return {
    id: row.id,
    userId: row.user_id,
    tier: row.tier,
    status: row.status,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

subscriptionsRouter.get('/', requireUser, async (req: AuthedRequest, res) => {
  try {
    const db = requireAdmin();
    const { data, error } = await db.from('subscriptions').select('*').eq('user_id', req.userId!).maybeSingle();
    if (error) throw error;
    if (!data) {
      res.json({ id: '', userId: req.userId, tier: 'free', status: 'active' });
      return;
    }
    res.json(mapSubscription(data));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to get subscription' });
  }
});

subscriptionsRouter.post('/webhook/revenuecat', async (req, res) => {
  try {
    const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
    if (secret && req.headers.authorization !== `Bearer ${secret}`) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const event = req.body as {
      event?: {
        type?: string;
        app_user_id?: string;
        product_id?: string;
        expiration_at_ms?: number;
        period_type?: string;
      };
    };

    const userId = event.event?.app_user_id;
    if (!userId) {
      res.json({ received: true });
      return;
    }

    const db = requireAdmin();
    const eventType = event.event?.type ?? '';
    const isActive = ['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE', 'TRIAL_STARTED', 'TRIAL_CONVERTED'].includes(eventType);
    const isTrial = eventType === 'TRIAL_STARTED' || event.event?.period_type === 'TRIAL';
    const tier = isActive ? 'premium' : 'free';
    const status = isActive ? (isTrial ? 'trialing' : 'active') : 'expired';
    const periodEnd = event.event?.expiration_at_ms ? new Date(event.event.expiration_at_ms).toISOString() : null;

    await db.from('subscriptions').upsert(
      {
        user_id: userId,
        tier,
        status,
        current_period_end: periodEnd,
        metadata: { source: 'revenuecat_webhook', eventType, productId: event.event?.product_id, isTrial },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    const { data: subRow } = await db.from('subscriptions').select('id').eq('user_id', userId).maybeSingle();
    if (subRow?.id) {
      await db.from('subscription_events').insert({
        subscription_id: subRow.id,
        event_type: eventType || 'webhook',
        payload: { productId: event.event?.product_id, isTrial, status },
      });
    }

    res.json({ received: true });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Webhook failed' });
  }
});

subscriptionsRouter.post('/upgrade', requireUser, async (req: AuthedRequest, res) => {
  try {
    const db = requireAdmin();
    const userId = req.userId!;
    const { tier = 'premium', sandbox } = req.body as { tier?: string; sandbox?: boolean };

    if (!sandbox && process.env.NODE_ENV === 'production') {
      res.status(400).json({ message: 'Use RevenueCat for production purchases.' });
      return;
    }

    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const { data, error } = await db
      .from('subscriptions')
      .upsert(
        {
          user_id: userId,
          tier,
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: periodEnd.toISOString(),
          metadata: { source: sandbox ? 'sandbox' : 'manual' },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select('*')
      .single();

    if (error) throw error;
    res.json(mapSubscription(data));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Upgrade failed' });
  }
});

subscriptionsRouter.post('/cancel', requireUser, async (req: AuthedRequest, res) => {
  try {
    const db = requireAdmin();
    const { data, error } = await db
      .from('subscriptions')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('user_id', req.userId!)
      .select('*')
      .single();

    if (error) throw error;
    res.json(mapSubscription(data));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Cancel failed' });
  }
});

subscriptionsRouter.post('/restore', requireUser, async (req: AuthedRequest, res) => {
  try {
    const db = requireAdmin();
    const userId = req.userId!;
    const { data, error } = await db.from('subscriptions').select('*').eq('user_id', userId).maybeSingle();
    if (error) throw error;

    if (data && data.tier !== 'free' && (data.status === 'active' || data.status === 'trialing')) {
      res.json(mapSubscription(data));
      return;
    }

    res.status(404).json({ message: 'No active subscription found.' });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Restore failed' });
  }
});

export const adsRouter = Router();
export const notificationsRouter = Router();

notificationsRouter.post('/register', requireUser, async (req: AuthedRequest, res) => {
  try {
    const db = requireAdmin();
    const userId = req.userId!;
    const { deviceToken, platform = 'ios' } = req.body as { deviceToken?: string; platform?: string };

    if (!deviceToken) {
      res.status(400).json({ message: 'deviceToken required' });
      return;
    }

    await db.from('user_devices').insert({
      user_id: userId,
      device_token: deviceToken,
      platform,
      is_active: true,
      last_seen_at: new Date().toISOString(),
    });

    res.json({ registered: true });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Registration failed' });
  }
});

notificationsRouter.post('/send', requireUser, async (req: AuthedRequest, res) => {
  try {
    const db = requireAdmin();
    const userId = req.userId!;
    const { title, body, type = 'system' } = req.body as { title?: string; body?: string; type?: string };

    const { data: devices } = await db.from('user_devices').select('device_token').eq('user_id', userId).eq('is_active', true);
    const tokens = (devices ?? []).map((d) => d.device_token).filter(Boolean);

    if (tokens.length === 0) {
      res.status(400).json({ message: 'No registered devices' });
      return;
    }

    const messages = tokens.map((token) => ({
      to: token,
      sound: 'default',
      title: title ?? 'LiftFlow',
      body: body ?? '',
      data: { type },
    }));

    const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });

    await db.from('notifications').insert({
      user_id: userId,
      type,
      title: title ?? 'LiftFlow',
      body: body ?? '',
      payload: {},
      is_read: false,
      sent_at: new Date().toISOString(),
    });

    const result = await pushResponse.json();
    res.json({ sent: tokens.length, result });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Send failed' });
  }
});

notificationsRouter.get('/', requireUser, async (req: AuthedRequest, res) => {
  try {
    const db = requireAdmin();
    const { data, error } = await db
      .from('notifications')
      .select('*')
      .eq('user_id', req.userId!)
      .order('sent_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json({ notifications: data ?? [] });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'List failed' });
  }
});

adsRouter.get('/', (req, res) => notImplemented(req, res, 'List ads'));
