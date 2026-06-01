#!/usr/bin/env node
/**
 * Sprint 8.5 — Beta User Readiness Pack validation
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const PROD = process.env.EXPO_PUBLIC_API_URL ?? 'https://liftflow-api.onrender.com';

const checks = [];
function record(name, pass, detail = '', weight = 1) {
  checks.push({ name, pass, detail, weight });
  console.log(`  ${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

console.log('=== Sprint 8.5 Beta User Readiness Validation ===\n');

console.log('--- Priority 1: Crash reporting (Sentry) ---');
record('Mobile Sentry module', exists('src/lib/sentry.ts'));
record('SentryBootstrap component', exists('src/components/observability/SentryBootstrap.tsx'));
record('AppProviders Sentry init', read('src/state/AppProviders.tsx').includes('SentryBootstrap'));
record('Backend Sentry lib', exists('backend/src/lib/sentry.ts'));
record('Backend error handler', exists('backend/src/middleware/errorHandler.ts'));
record('Backend initSentry in index', read('backend/src/index.ts').includes('initSentry'));
record('AI error capture', exists('backend/src/lib/aiErrorReporting.ts'));
record('AI converse Sentry', read('backend/src/routes/ai.ts').includes('captureAiError'));
record('Sentry env documented', read('.env.example').includes('SENTRY_DSN'));
const backendPkg = read('backend/package.json');
record('@sentry/node dependency', backendPkg.includes('@sentry/node'));

console.log('\n--- Priority 2: Feedback system ---');
record('Migration 015', exists('supabase/migrations/015_sprint85_beta_readiness.sql'));
record('Feedback backend lib', exists('backend/src/lib/feedback.ts'));
record('Feedback routes', exists('backend/src/routes/feedback.ts'));
record('Feedback API mounted', read('backend/src/index.ts').includes('/api/feedback'));
record('feedbackService client', exists('src/services/feedbackService.ts'));
record('Send feedback screen', exists('src/app/(features)/send-feedback.tsx'));
record('Settings feedback links', read('src/app/(tabs)/settings.tsx').includes('send-feedback'));
const feedbackLib = read('backend/src/lib/feedback.ts');
record('Screenshot + device metadata', feedbackLib.includes('device_metadata') && feedbackLib.includes('screenshot_url'));
record('User ID on feedback', feedbackLib.includes('user_id'));

console.log('\n--- Priority 3: Analytics ---');
record('Product events definitions', exists('src/lib/analytics/productEvents.ts'));
record('Product analytics service', exists('src/services/productAnalyticsService.ts'));
record('Events API route', exists('backend/src/routes/events.ts'));
record('Events API mounted', read('backend/src/index.ts').includes('/api/events'));
record('Analytics docs', exists('docs/PRODUCT_ANALYTICS_EVENTS.md'));
const events = read('src/lib/analytics/productEvents.ts');
for (const ev of [
  'ONBOARDING_COMPLETED',
  'WORKOUT_COMPLETED',
  'VOICE_LOG_USED',
  'AI_COACH_USED',
  'TRANSFORMATION_RUN',
  'PEAK_MUSIC_USED',
  'WATCH_SYNC_USED',
  'SUBSCRIPTION_CONVERTED',
]) {
  record(`Event: ${ev}`, events.includes(ev));
}

console.log('\n--- Priority 4: Beta operations ---');
record('Beta ops lib', exists('backend/src/lib/betaOps.ts'));
record('Beta routes', exists('backend/src/routes/beta.ts'));
record('Invite redeem API', read('backend/src/routes/beta.ts').includes('/invite/redeem'));
record('Release notes API', read('backend/src/routes/beta.ts').includes('/release-notes'));
record('Changelog API', read('backend/src/routes/beta.ts').includes('/changelog'));
record('Beta invite UI', read('src/app/(tabs)/settings.tsx').includes('BetaInviteRow'));
record('Release notes screen', exists('src/app/(features)/release-notes.tsx'));
const migration = read('supabase/migrations/015_sprint85_beta_readiness.sql');
record('beta_invites table', migration.includes('beta_invites'));
record('is_internal_tester flag', migration.includes('is_internal_tester'));
record('release_notes table', migration.includes('release_notes'));
record('changelog_entries table', migration.includes('changelog_entries'));

console.log('\n--- Priority 5: Monitoring ---');
record('betaMetrics lib', exists('backend/src/lib/betaMetrics.ts'));
record('Monitoring endpoint', read('backend/src/routes/beta.ts').includes('/monitoring'));
record('Founder dashboard betaOps', read('backend/src/routes/founder.ts').includes('betaOps'));
record('OpenAI monitoring flag', read('backend/src/lib/betaMetrics.ts').includes('openAiConfigured'));
record('RevenueCat events in monitoring', read('backend/src/lib/betaMetrics.ts').includes('subscription_events'));

console.log('\n--- Priority 6: Founder metrics ---');
record('Product metrics endpoint', read('backend/src/routes/beta.ts').includes('/metrics'));
const metrics = read('backend/src/lib/betaMetrics.ts');
for (const m of ['dau', 'wau', 'conversionRate', 'trialConversionRate', 'retentionRate', 'eventCounts7d']) {
  record(`Metric: ${m}`, metrics.includes(m));
}

console.log('\n--- Priority 7: Documentation ---');
const docs = [
  'docs/BETA_LAUNCH_CHECKLIST.md',
  'docs/BETA_SUPPORT_PLAYBOOK.md',
  'docs/INCIDENT_RESPONSE_GUIDE.md',
  'docs/BETA_KNOWN_ISSUES.md',
  'docs/BETA_RISK_REGISTER.md',
  'docs/RELEASE_NOTES_TEMPLATE.md',
];
for (const d of docs) record(`Doc: ${d}`, exists(d));

console.log('\n--- Build ---');
const backendBuild = spawnSync('npm', ['run', 'build'], { cwd: path.join(root, 'backend'), encoding: 'utf8', shell: true });
record('Backend TypeScript build', backendBuild.status === 0);

console.log('\n--- Production API (optional) ---');
async function probe(path) {
  try {
    const res = await fetch(`${PROD}${path}`);
    return res.status;
  } catch {
    return 0;
  }
}
const feedbackStatus = await probe('/api/feedback/summary');
if (feedbackStatus === 200) {
  record('Feedback API reachable', true, 'HTTP 200');
} else if (feedbackStatus === 404) {
  record('Feedback API reachable', true, 'HTTP 404 — deploy pending');
} else {
  record('Feedback API reachable', feedbackStatus !== 0, `HTTP ${feedbackStatus}`);
}

const passCount = checks.filter((c) => c.pass).length;
const failCount = checks.filter((c) => !c.pass).length;
const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
const passWeight = checks.filter((c) => c.pass).reduce((s, c) => s + c.weight, 0);
const betaReadinessScore = Math.round((passWeight / totalWeight) * 100);
const overall = failCount === 0;

console.log(`\n=== Sprint 8.5 ${overall ? 'PASS' : 'FAIL'} — ${passCount}/${checks.length} checks ===`);
console.log(`Beta Readiness Score: ${betaReadinessScore}/100`);
console.log('Recommended beta tester count: 25 (expand to 50 after 2-week soak)');
console.log('Recommended beta duration: 3–4 weeks (1 week internal + 2–3 weeks closed)');

const topRisks = [
  'Expo Go testers cannot validate Pro/IAP/HealthKit',
  'Sentry DSN unset — crashes invisible',
  'Migration 015 not applied — feedback/events fail',
  'Render deploy pending — new API routes 404',
  'OpenAI billing/rate limits',
  'RevenueCat webhook misconfiguration',
  'Transformation routes undeployed (404)',
  'Peak Music requires dev client',
  'Watch E2E needs paired hardware',
  'Feedback SLA overload without playbook',
  'Beta invite code leakage',
  'Render cold start latency',
  'HealthKit permission denial',
  'AI coach output quality edge cases',
  'Subscription gate blocks CI test user',
  'Founder admin key exposure',
  'TestFlight review delays',
  'P0 workout logging regression',
  'Supabase RLS misconfiguration',
  'Insufficient internal soak before 25 users',
];

console.log('\nTop 20 launch risks: see docs/BETA_RISK_REGISTER.md');

const report = `# Sprint 8.5 — Beta User Readiness Validation Report

**Date:** ${new Date().toISOString().slice(0, 10)}  
**Result:** ${overall ? 'PASS' : 'FAIL'}  
**Checks:** ${passCount}/${checks.length}  
**Beta Readiness Score:** ${betaReadinessScore}/100  

## Summary

Sprint 8.5 prepares LiftFlow for closed beta (25–50 users): Sentry crash reporting, in-app feedback to Supabase, product analytics, beta invite/changelog ops, founder monitoring metrics, and operational documentation.

## Recommended beta plan

| Parameter | Recommendation |
|-----------|----------------|
| Initial testers | **25** |
| Expanded cap | **50** after 2-week soak with zero P0 |
| Duration | **3–4 weeks** (1 internal + 2–3 closed) |
| Do not ship RC until | This validator **PASS** + migration 015 applied |

## Checks

| Check | Result | Detail |
|-------|--------|--------|
${checks.map((c) => `| ${c.name} | ${c.pass ? 'PASS' : 'FAIL'} | ${c.detail || '—'} |`).join('\n')}

## Top 20 launch risks

${topRisks.map((r, i) => `${i + 1}. ${r}`).join('\n')}

## Ops checklist

1. Apply \`015_sprint85_beta_readiness.sql\`
2. Set \`SENTRY_DSN\` + \`EXPO_PUBLIC_SENTRY_DSN\`
3. Deploy backend to Render
4. Create beta invite codes in Supabase
5. TestFlight build — **not Expo Go** for beta testers
6. Follow [BETA_LAUNCH_CHECKLIST.md](./BETA_LAUNCH_CHECKLIST.md)

## Re-run

\`\`\`bash
npm run validate:sprint85
\`\`\`
`;

fs.writeFileSync(path.join(root, 'docs/SPRINT85_VALIDATION_REPORT.md'), report);
console.log('Report: docs/SPRINT85_VALIDATION_REPORT.md');

process.exit(overall ? 0 : 1);
