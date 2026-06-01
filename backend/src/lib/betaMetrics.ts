import { requireAdmin } from './supabase.js';

export type TrackEventInput = {
  userId?: string;
  sessionId?: string;
  eventName: string;
  properties?: Record<string, unknown>;
  appVersion?: string;
  appEnvironment?: string;
  platform?: string;
};

export async function trackAppEvent(input: TrackEventInput) {
  const db = requireAdmin();
  const { data, error } = await db
    .from('app_events')
    .insert({
      user_id: input.userId ?? null,
      session_id: input.sessionId,
      event_name: input.eventName,
      properties: input.properties ?? {},
      app_version: input.appVersion,
      app_environment: input.appEnvironment,
      platform: input.platform,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getProductMetrics() {
  const db = requireAdmin();
  const cutoff7 = new Date();
  cutoff7.setDate(cutoff7.getDate() - 7);
  const cutoff30 = new Date();
  cutoff30.setDate(cutoff30.getDate() - 30);

  const [events7, events30, profiles] = await Promise.all([
    db.from('app_events').select('user_id, event_name, created_at').gte('created_at', cutoff7.toISOString()),
    db.from('app_events').select('user_id, created_at').gte('created_at', cutoff30.toISOString()),
    db.from('profiles').select('id, created_at, onboarding_completed').is('deleted_at', null),
  ]);

  const events7Data = events7.data ?? [];
  const events30Data = events30.data ?? [];
  const profilesData = profiles.data ?? [];

  const dauSet = new Set(events7Data.map((e) => e.user_id).filter(Boolean));
  const wauSet = new Set(
    events7Data
      .filter((e) => new Date(e.created_at) >= new Date(Date.now() - 7 * 86400000))
      .map((e) => e.user_id)
      .filter(Boolean),
  );

  const eventCounts: Record<string, number> = {};
  for (const e of events7Data) {
    eventCounts[e.event_name] = (eventCounts[e.event_name] ?? 0) + 1;
  }

  const onboardingCompleted = profilesData.filter((p) => p.onboarding_completed).length;
  const totalUsers = profilesData.length;

  const subsRes = await db.from('subscriptions').select('user_id, status, tier');
  const subs = subsRes.data ?? [];
  const trialing = subs.filter((s) => s.status === 'trialing').length;
  const activePro = subs.filter((s) => s.status === 'active' && s.tier !== 'free').length;
  const conversionRate = totalUsers > 0 ? Math.round((activePro / totalUsers) * 10000) / 100 : 0;
  const trialConversionRate = trialing + activePro > 0 ? Math.round((activePro / (trialing + activePro)) * 10000) / 100 : 0;

  const retentionCutoff = new Date();
  retentionCutoff.setDate(retentionCutoff.getDate() - 14);
  const newUsers14 = profilesData.filter((p) => new Date(p.created_at) >= retentionCutoff).length;
  const retained14 = profilesData.filter(
    (p) =>
      new Date(p.created_at) >= retentionCutoff &&
      events30Data.some((e) => e.user_id === p.id),
  ).length;
  const retentionRate = newUsers14 > 0 ? Math.round((retained14 / newUsers14) * 10000) / 100 : 0;

  return {
    dau: dauSet.size,
    wau: wauSet.size,
    mau: new Set(events30Data.map((e) => e.user_id).filter(Boolean)).size,
    eventCounts7d: eventCounts,
    onboardingCompletionRate: totalUsers > 0 ? Math.round((onboardingCompleted / totalUsers) * 10000) / 100 : 0,
    conversionRate,
    trialConversionRate,
    retentionRate14d: retentionRate,
    totalUsers,
    activePro,
    trialing,
  };
}

export async function getMonitoringSnapshot() {
  const db = requireAdmin();
  const since24 = new Date(Date.now() - 86400000).toISOString();

  const [feedback, events, subsEvents] = await Promise.all([
    db.from('beta_feedback').select('id').gte('created_at', since24),
    db.from('app_events').select('id, event_name').gte('created_at', since24),
    db.from('subscription_events').select('event_type').gte('created_at', since24),
  ]);

  const rcEvents: Record<string, number> = {};
  for (const e of subsEvents.data ?? []) {
    rcEvents[e.event_type] = (rcEvents[e.event_type] ?? 0) + 1;
  }

  return {
    apiHealth: 'ok',
    feedbackLast24h: feedback.data?.length ?? 0,
    eventsLast24h: events.data?.length ?? 0,
    revenueCatEvents24h: rcEvents,
    renderUptimeNote: 'Monitor via Render dashboard + Sentry uptime',
    openAiConfigured: Boolean(process.env.OPENAI_API_KEY),
    sentryConfigured: Boolean(process.env.SENTRY_DSN),
  };
}
