import { Router } from 'express';

import { mergeIncomingHealthSamples } from '../lib/healthSyncEngine.js';
import { applyHealthToRecoveryCheckIn, loadHealthContext } from '../lib/loadHealthContext.js';
import {
    buildStravaAuthUrl,
    exchangeStravaCode,
    fetchStravaActivities,
    isStravaConfigured,
    mapStravaToCardio,
    refreshStravaToken,
} from '../lib/strava.js';
import { requireAdmin } from '../lib/supabase.js';
import type { AuthedRequest } from '../middleware/authUser.js';
import { requireUser } from '../middleware/authUser.js';

export const integrationsRouter = Router();

integrationsRouter.get('/', requireUser, async (req: AuthedRequest, res) => {
  try {
    const db = requireAdmin();
    const userId = req.userId!;
    const { data, error } = await db.from('integration_connections').select('*').eq('user_id', userId);
    if (error) throw error;
    res.json({ connections: data ?? [] });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to list integrations' });
  }
});

integrationsRouter.post('/healthkit/sync', requireUser, async (req: AuthedRequest, res) => {
  try {
    const db = requireAdmin();
    const userId = req.userId!;
    const { samples } = req.body as { samples?: { dataType: string; externalId?: string; value: Record<string, unknown>; recordedAt: string }[] };

    if (!Array.isArray(samples) || samples.length === 0) {
      res.json({ synced: 0, inserted: 0, updated: 0, skipped: 0, conflicts: 0 });
      return;
    }

    const since = new Date();
    since.setDate(since.getDate() - 30);
    const { data: existingRows } = await db
      .from('healthkit_sync_records')
      .select('id, user_id, data_type, external_id, value, recorded_at, synced_at')
      .eq('user_id', userId)
      .gte('recorded_at', since.toISOString());

    const incoming = samples.map((s) => ({
      dataType: s.dataType,
      externalId: s.externalId ?? null,
      value: s.value,
      recordedAt: s.recordedAt,
    }));

    const { rows, stats } = mergeIncomingHealthSamples(
      (existingRows ?? []).map((row) => ({
        id: row.id,
        user_id: row.user_id,
        synced_at: row.synced_at,
        dataType: row.data_type,
        externalId: row.external_id,
        value: row.value as Record<string, unknown>,
        recordedAt: row.recorded_at,
      })),
      incoming,
    );

    const insertRows = rows.map((s) => ({
      user_id: userId,
      data_type: s.dataType,
      external_id: s.externalId,
      value: s.value,
      recorded_at: s.recordedAt,
    }));

    if (insertRows.length > 0) {
      const { error } = await db.from('healthkit_sync_records').upsert(insertRows, {
        onConflict: 'user_id,data_type,external_id',
        ignoreDuplicates: false,
      });
      if (error) {
        await db.from('healthkit_sync_records').insert(insertRows);
      }
    }

    await db.from('integration_connections').upsert(
      { user_id: userId, provider: 'apple_healthkit', is_connected: true, last_sync_at: new Date().toISOString(), sync_status: 'synced' },
      { onConflict: 'user_id,provider' },
    );

    const context = await loadHealthContext(userId);
    await applyHealthToRecoveryCheckIn(userId, new Date().toISOString().slice(0, 10), context);

    res.json({ synced: insertRows.length, ...stats });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'HealthKit sync failed' });
  }
});

integrationsRouter.get('/health/context', requireUser, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    res.json(await loadHealthContext(userId));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Health context failed' });
  }
});

integrationsRouter.post('/health/context/refresh', requireUser, async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const context = await loadHealthContext(userId);
    await applyHealthToRecoveryCheckIn(userId, new Date().toISOString().slice(0, 10), context);
    res.json(context);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Health refresh failed' });
  }
});

integrationsRouter.post('/health-connect/sync', requireUser, async (req: AuthedRequest, res) => {
  try {
    const db = requireAdmin();
    const userId = req.userId!;
    const { samples } = req.body as { samples?: { dataType: string; externalId?: string; value: Record<string, unknown>; recordedAt: string }[] };

    if (!Array.isArray(samples) || samples.length === 0) {
      res.json({ synced: 0 });
      return;
    }

    const rows = samples.map((s) => ({
      user_id: userId,
      data_type: s.dataType,
      external_id: s.externalId ?? null,
      value: { ...s.value, provider: 'health_connect' },
      recorded_at: s.recordedAt,
    }));

    const { error } = await db.from('healthkit_sync_records').insert(rows);
    if (error) throw error;

    await db.from('integration_connections').upsert(
      { user_id: userId, provider: 'google_fit', is_connected: true, last_sync_at: new Date().toISOString(), sync_status: 'synced' },
      { onConflict: 'user_id,provider' },
    );

    res.json({ synced: rows.length });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Health Connect sync failed' });
  }
});

integrationsRouter.post('/watch/sync', requireUser, async (req: AuthedRequest, res) => {
  try {
    const db = requireAdmin();
    const userId = req.userId!;
    const payload = req.body as {
      workoutSessionId?: string;
      startedAt: string;
      endedAt?: string;
      heartRateSamples?: { recordedAt: string; bpm: number }[];
      motionSummary?: Record<string, unknown>;
    };

    const { data, error } = await db
      .from('watch_sessions')
      .insert({
        user_id: userId,
        workout_session_id: payload.workoutSessionId ?? null,
        started_at: payload.startedAt,
        ended_at: payload.endedAt ?? null,
        heart_rate_samples: payload.heartRateSamples ?? [],
        motion_summary: payload.motionSummary ?? {},
      })
      .select('id')
      .single();

    if (error) throw error;

    await db.from('integration_connections').upsert(
      { user_id: userId, provider: 'apple_watch', is_connected: true, last_sync_at: new Date().toISOString(), sync_status: 'synced' },
      { onConflict: 'user_id,provider' },
    );

    res.json({ sessionId: data.id });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Watch sync failed' });
  }
});

/** Strava OAuth — start authorization (pass userId from authenticated client) */
integrationsRouter.get('/strava/authorize', (req, res) => {
  if (!isStravaConfigured()) {
    res.status(503).json({ message: 'Strava not configured. Set STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REDIRECT_URI on backend.' });
    return;
  }

  const redirectUri = (req.query.redirect_uri as string) ?? process.env.STRAVA_REDIRECT_URI!;
  const userId = req.query.userId as string | undefined;
  if (!userId) {
    res.status(400).json({ message: 'userId query parameter required' });
    return;
  }

  const state = Buffer.from(JSON.stringify({ redirectUri, userId, ts: Date.now() })).toString('base64url');
  res.redirect(buildStravaAuthUrl(state, process.env.STRAVA_REDIRECT_URI!));
});

/** Strava OAuth callback */
integrationsRouter.get('/strava/callback', async (req, res) => {
  try {
    const code = req.query.code as string | undefined;
    const stateRaw = req.query.state as string | undefined;

    if (!code || !stateRaw) {
      res.status(400).send('Missing authorization code');
      return;
    }

    const state = JSON.parse(Buffer.from(stateRaw, 'base64url').toString()) as { redirectUri: string; userId: string };
    const tokens = await exchangeStravaCode(code);
    const db = requireAdmin();

    // Store tokens — in production encrypt at rest
    await db.from('integration_connections').upsert(
      {
        user_id: state.userId,
        provider: 'strava',
        is_connected: true,
        access_token_encrypted: tokens.access_token,
        refresh_token_encrypted: tokens.refresh_token,
        scopes: ['read', 'activity:read_all'],
        metadata: { athlete_id: tokens.athlete.id, expires_at: tokens.expires_at },
        sync_status: 'synced',
        last_sync_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider' },
    );

    res.redirect(`${state.redirectUri}?connected=strava`);
  } catch (error) {
    res.status(500).send(error instanceof Error ? error.message : 'Strava callback failed');
  }
});

integrationsRouter.post('/strava/sync', requireUser, async (req: AuthedRequest, res) => {
  try {
    const db = requireAdmin();
    const userId = req.userId!;

    const { data: connection, error: connError } = await db
      .from('integration_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'strava')
      .maybeSingle();

    if (connError || !connection?.access_token_encrypted) {
      res.status(400).json({ message: 'Strava not connected' });
      return;
    }

    let accessToken = connection.access_token_encrypted as string;
    const expiresAt = (connection.metadata as { expires_at?: number })?.expires_at;
    if (expiresAt && expiresAt * 1000 < Date.now() && connection.refresh_token_encrypted) {
      const refreshed = await refreshStravaToken(connection.refresh_token_encrypted as string);
      accessToken = refreshed.access_token;
      await db
        .from('integration_connections')
        .update({
          access_token_encrypted: refreshed.access_token,
          refresh_token_encrypted: refreshed.refresh_token,
          metadata: { ...(connection.metadata as object), expires_at: refreshed.expires_at },
        })
        .eq('id', connection.id);
    }

    const after = Math.floor(Date.now() / 1000) - 90 * 24 * 3600;
    const activities = await fetchStravaActivities(accessToken, after);

    let imported = 0;
    for (const activity of activities) {
      const row = mapStravaToCardio(activity);
      const { error } = await db.from('cardio_sessions').insert({ user_id: userId, ...row });
      if (!error) imported += 1;
    }

    await db.from('integration_connections').update({ last_sync_at: new Date().toISOString(), sync_status: 'synced' }).eq('id', connection.id);

    res.json({ imported });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Strava sync failed' });
  }
});

integrationsRouter.get('/strava/activities', requireUser, async (req: AuthedRequest, res) => {
  try {
    const db = requireAdmin();
    const userId = req.userId!;
    const { data, error } = await db
      .from('cardio_sessions')
      .select('*')
      .eq('user_id', userId)
      .contains('metadata', { source: 'strava' })
      .order('started_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    const activities = (data ?? []).map((row) => ({
      externalId: (row.metadata as { external_id?: string })?.external_id,
      name: row.notes,
      type: (row.metadata as { activity_type?: string })?.activity_type,
      startedAt: row.started_at,
      durationSeconds: row.duration_seconds,
      distanceMeters: row.distance_meters,
      calories: row.calories_burned,
      avgPaceSecPerKm: row.avg_pace_sec_per_km,
      avgHeartRate: row.avg_heart_rate,
      elevationGainM: row.elevation_gain_m,
    }));

    res.json({ activities });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to fetch activities' });
  }
});

integrationsRouter.post('/strava/disconnect', requireUser, async (req: AuthedRequest, res) => {
  try {
    const db = requireAdmin();
    const userId = req.userId!;
    await db
      .from('integration_connections')
      .update({ is_connected: false, access_token_encrypted: null, refresh_token_encrypted: null, sync_status: 'pending' })
      .eq('user_id', userId)
      .eq('provider', 'strava');
    res.json({ disconnected: true });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Disconnect failed' });
  }
});

integrationsRouter.post('/:provider/disconnect', requireUser, async (req: AuthedRequest, res) => {
  try {
    const db = requireAdmin();
    const userId = req.userId!;
    const provider = req.params.provider;
    await db
      .from('integration_connections')
      .update({ is_connected: false, sync_status: 'pending' })
      .eq('user_id', userId)
      .eq('provider', provider);
    res.json({ disconnected: true });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Disconnect failed' });
  }
});
