import { getMonitoringSnapshot, getProductMetrics } from './betaMetrics.js';
import { getFeedbackSummary } from './feedback.js';
import { requireAdmin } from './supabase.js';

const SOAK_EVENTS = [
  'onboarding_completed',
  'workout_completed',
  'voice_log_used',
  'ai_coach_used',
  'recovery_viewed',
  'nutrition_viewed',
  'transformation_run',
  'peak_music_used',
  'watch_sync_used',
  'subscription_started',
  'subscription_converted',
  'feedback_submitted',
] as const;

export async function getBetaSoakStatus() {
  const db = requireAdmin();
  const since7 = new Date();
  since7.setDate(since7.getDate() - 7);

  const [internalProfiles, redemptions, events, feedbackOpen, invites] = await Promise.all([
    db
      .from('profiles')
      .select('id, email, beta_tester_tag, is_internal_tester, beta_invite_code')
      .or('is_internal_tester.eq.true,beta_invite_code.eq.LIFTFLOW-INTERNAL'),
    db.from('beta_invite_redemptions').select('user_id, redeemed_at, invite_id'),
    db.from('app_events').select('user_id, event_name, created_at').gte('created_at', since7.toISOString()),
    db.from('beta_feedback').select('id, feedback_type, subject, status, created_at').eq('status', 'open'),
    db.from('beta_invites').select('code, uses_count, max_uses, is_internal'),
  ]);

  const eventsData = events.data ?? [];
  const eventCounts: Record<string, number> = {};
  const usersByEvent: Record<string, Set<string>> = {};

  for (const ev of SOAK_EVENTS) {
    eventCounts[ev] = 0;
    usersByEvent[ev] = new Set();
  }

  for (const e of eventsData) {
    if (e.event_name in eventCounts) {
      eventCounts[e.event_name] += 1;
      if (e.user_id) usersByEvent[e.event_name].add(e.user_id);
    }
  }

  const internalCount = internalProfiles.data?.length ?? 0;
  const internalTarget = { min: 5, max: 10 };

  const soakChecklist = SOAK_EVENTS.map((name) => ({
    event: name,
    count7d: eventCounts[name],
    uniqueUsers7d: usersByEvent[name].size,
    passed: eventCounts[name] > 0,
  }));

  const inviteRows = invites.data ?? [];
  const internalInvite = inviteRows.find((i) => i.code === 'LIFTFLOW-INTERNAL');

  return {
    phase: 'internal_soak',
    internalTesters: {
      registered: internalCount,
      target: internalTarget,
      inviteUses: internalInvite?.uses_count ?? 0,
      inviteMax: internalInvite?.max_uses ?? 10,
    },
    soakEvents: soakChecklist,
    openFeedback: feedbackOpen.data?.length ?? 0,
    openFeedbackItems: (feedbackOpen.data ?? []).slice(0, 20),
    redemptionsLast7d: redemptions.data?.length ?? 0,
    soakComplete:
      internalCount >= internalTarget.min &&
      soakChecklist.filter((s) =>
        ['workout_completed', 'voice_log_used', 'ai_coach_used', 'feedback_submitted'].includes(s.event),
      ).every((s) => s.passed),
  };
}

export async function getBetaRetentionMetrics() {
  const [metrics, monitoring, feedback, soak] = await Promise.all([
    getProductMetrics(),
    getMonitoringSnapshot(),
    getFeedbackSummary(),
    getBetaSoakStatus(),
  ]);

  return {
    retention: {
      dau: metrics.dau,
      wau: metrics.wau,
      mau: metrics.mau,
      retentionRate14d: metrics.retentionRate14d,
      onboardingCompletionRate: metrics.onboardingCompletionRate,
    },
    conversion: {
      conversionRate: metrics.conversionRate,
      trialConversionRate: metrics.trialConversionRate,
      activePro: metrics.activePro,
      trialing: metrics.trialing,
    },
    engagement: metrics.eventCounts7d,
    monitoring,
    feedback,
    soak,
  };
}

export async function getLaunchBlockers() {
  const soak = await getBetaSoakStatus();
  const blockers: { severity: 'P0' | 'P1' | 'P2'; issue: string; status: 'open' | 'closed' }[] = [];

  if (soak.internalTesters.registered < soak.internalTesters.target.min) {
    blockers.push({
      severity: 'P1',
      issue: `Internal testers ${soak.internalTesters.registered}/${soak.internalTesters.target.min} — invite via LIFTFLOW-INTERNAL`,
      status: 'open',
    });
  }

  const coreEvents = ['workout_completed', 'voice_log_used', 'ai_coach_used'];
  for (const ev of coreEvents) {
    const row = soak.soakEvents.find((s) => s.event === ev);
    if (!row?.passed) {
      blockers.push({
        severity: 'P1',
        issue: `Soak event missing: ${ev} (0 events in 7d)`,
        status: 'open',
      });
    }
  }

  if (soak.openFeedback > 10) {
    blockers.push({
      severity: 'P2',
      issue: `${soak.openFeedback} open feedback items — triage backlog`,
      status: 'open',
    });
  }

  const p0 = blockers.filter((b) => b.severity === 'P0' && b.status === 'open');
  const p1 = blockers.filter((b) => b.severity === 'P1' && b.status === 'open');

  return {
    blockers,
    p0Count: p0.length,
    p1Count: p1.length,
    wave1Authorized: p0.length === 0 && p1.length === 0 && soak.soakComplete,
    expandTo50Recommended: p0.length === 0 && p1.length === 0 && soak.soakComplete,
  };
}
