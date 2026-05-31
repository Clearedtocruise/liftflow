#!/usr/bin/env node
/**
 * Sprint 8.6 — TestFlight Release Candidate validation
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { loadRootEnv, projectRefFromUrl } from './lib/migration010.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const PROD = process.env.EXPO_PUBLIC_API_URL ?? 'https://liftflow-api.onrender.com';
const TEST_USER = '00000000-0000-0000-0000-000000000001';

const checks = [];
const p0Issues = [];
const p1Issues = [];

function record(name, pass, detail = '', weight = 1, severity = null) {
  checks.push({ name, pass, detail, weight });
  console.log(`  ${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`);
  if (!pass && severity === 'P0') p0Issues.push(`${name}: ${detail || 'failed'}`);
  if (!pass && severity === 'P1') p1Issues.push(`${name}: ${detail || 'failed'}`);
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function runValidator(script) {
  const r = spawnSync('node', [script], { cwd: root, encoding: 'utf8', timeout: 180000, shell: false });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  const m = out.match(/(\d+)\/(\d+) checks/) || out.match(/Summary: (\d+)\/(\d+)/);
  const pass = m ? Number(m[1]) : r.status === 0 ? 1 : 0;
  const total = m ? Number(m[2]) : 1;
  return { ok: r.status === 0, pass, total, out };
}

async function fetchStatus(url, init) {
  try {
    const res = await fetch(url, init);
    return { status: res.status, text: await res.text(), ok: res.ok };
  } catch (e) {
    return { status: 0, text: e instanceof Error ? e.message : 'fetch failed', ok: false };
  }
}

function routeLive(res) {
  return res.status !== 404 && !res.text.includes('Cannot GET') && !res.text.includes('Cannot POST');
}

async function verifyMigration015(env) {
  const accessToken = env.SUPABASE_ACCESS_TOKEN;
  const projectRef =
    env.SUPABASE_PROJECT_REF ?? projectRefFromUrl(env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL);
  if (!accessToken || !projectRef) return { ok: false, detail: 'SUPABASE_ACCESS_TOKEN missing' };

  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `select count(*)::int as n from information_schema.tables where table_schema='public' and table_name='beta_feedback'`,
      }),
    });
    const rows = JSON.parse(await res.text());
    const n = rows?.[0]?.n ?? 0;
    return { ok: n > 0, detail: n > 0 ? 'beta_feedback exists' : 'table missing' };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : 'verify failed' };
  }
}

async function verifyBetaInvitesSeeded(env) {
  const url = env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, detail: 'service role missing' };

  const res = await fetch(`${url}/rest/v1/beta_invites?code=eq.LIFTFLOW-INTERNAL&select=code`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
  const rows = await res.json();
  return { ok: Array.isArray(rows) && rows.length > 0, detail: rows.length ? 'LIFTFLOW-INTERNAL seeded' : 'not seeded' };
}

function envConfigured(key) {
  const env = loadRootEnv();
  const val = process.env[key] ?? env[key] ?? '';
  return val.length > 10 && !val.includes('your-');
}

console.log('=== Sprint 8.6 TestFlight Release Candidate Validation ===\n');

console.log('--- Sprint 8.5 operational preconditions ---');
const env = loadRootEnv();
const mig = await verifyMigration015(env);
record('Migration 015 applied', mig.ok, mig.detail, 2, mig.ok ? null : 'P0');

record('SENTRY_DSN configured', envConfigured('SENTRY_DSN'), envConfigured('SENTRY_DSN') ? 'set' : 'add to .env + Render', 1, envConfigured('SENTRY_DSN') ? null : 'P1');
record(
  'EXPO_PUBLIC_SENTRY_DSN documented',
  read('.env.example').includes('EXPO_PUBLIC_SENTRY_DSN'),
  envConfigured('EXPO_PUBLIC_SENTRY_DSN') ? 'set locally' : 'set in EAS secrets for build',
  1,
  envConfigured('EXPO_PUBLIC_SENTRY_DSN') ? null : 'P1',
);

const health = await fetchStatus(`${PROD}/health`);
record('Production health', health.ok, `HTTP ${health.status}`, 2, health.ok ? null : 'P0');

const sprint85 = runValidator('scripts/validate-sprint85-beta-readiness.mjs');
record('Sprint 8.5 regression', sprint85.ok, `${sprint85.pass}/${sprint85.total}`, 2, sprint85.ok ? null : 'P0');

console.log('\n--- Production route verification ---');
const prodRoutes = [
  ['Feedback summary', `${PROD}/api/feedback/summary`, 'GET'],
  ['Events track', `${PROD}/api/events/track`, 'POST', { eventName: 'test', userId: TEST_USER }],
  ['Beta release notes', `${PROD}/api/beta/release-notes`, 'GET'],
  ['Recovery intelligence', `${PROD}/api/training/recovery/intelligence?userId=${TEST_USER}`, 'GET'],
  ['Nutrition intelligence', `${PROD}/api/nutrition/intelligence?userId=${TEST_USER}`, 'GET'],
  ['AI converse', `${PROD}/api/ai/converse`, 'POST', { userId: TEST_USER, message: 'rc verify' }],
  ['Smart progression', `${PROD}/api/training/progression/smart`, 'POST', { userId: TEST_USER, exerciseId: TEST_USER }],
  ['Transformation latest', `${PROD}/api/body/transformation/latest?userId=${TEST_USER}`, 'GET'],
];

for (const [label, url, method, body] of prodRoutes) {
  const res = await fetchStatus(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const live = label === 'AI converse' ? res.status === 200 : routeLive(res);
  const sev = ['Feedback summary', 'Events track', 'Beta release notes'].includes(label) ? 'P0' : 'P0';
  record(`Route: ${label}`, live, `HTTP ${res.status}`, 1, live ? null : sev);
}

const invites = await verifyBetaInvitesSeeded(env);
record('Beta invite codes seeded', invites.ok, invites.detail, 1, invites.ok ? null : 'P1');

console.log('\n--- Core systems ---');
record('Authentication', exists('src/services/authService.ts') && exists('src/app/(auth)/login.tsx'));
record('Onboarding', read('src/app/(onboarding)/profile.tsx').includes('onboardingCompleted'));
record('Workout logging', exists('src/state/workout/WorkoutSessionContext.tsx'));
record('Voice logging', read('src/app/(tabs)/workout.tsx').includes('processVoiceTranscript'));
record('AI Coach', exists('src/app/(features)/coach-chat.tsx'));
record('Recovery Intelligence', exists('src/app/(features)/recovery-analysis.tsx'));
record('Nutrition Intelligence', exists('src/app/(features)/nutrition-intelligence.tsx'));
record(
  'Smart Progression',
  exists('src/services/progressionService.ts') && read('backend/src/routes/training.ts').includes('/progression/smart'),
);

console.log('\n--- Premium systems ---');
const sprint81 = runValidator('scripts/validate-sprint81-revenuecat.mjs');
record('RevenueCat (Sprint 8.1)', sprint81.ok, `${sprint81.pass}/${sprint81.total}`);
record('Feature gates', read('src/components/subscription/PremiumGate.tsx').includes('FeatureGate'));
record('Restore purchases', read('src/services/subscriptionService.ts').includes('restorePurchases'));
record('Trial support', read('src/lib/entitlements.ts').includes('isTrialingSubscription'));

console.log('\n--- Advanced features ---');
const sprint82 = runValidator('scripts/validate-sprint82-transformation.mjs');
record('Transformation (8.2)', sprint82.ok, `${sprint82.pass}/${sprint82.total}`);
const sprint83 = runValidator('scripts/validate-sprint83-peak-music.mjs');
record('Peak Music (8.3)', sprint83.ok, `${sprint83.pass}/${sprint83.total}`);
const sprint84 = runValidator('scripts/validate-sprint84-watch.mjs');
record('Watch Companion (8.4)', sprint84.ok, `${sprint84.pass}/${sprint84.total}`);
record('HealthKit plugin', read('app.config.ts').includes('@kingstinct/react-native-healthkit'));

console.log('\n--- Operations ---');
record('Mobile Sentry bootstrap', exists('src/components/observability/SentryBootstrap.tsx'));
record('Feedback submission', exists('src/app/(features)/send-feedback.tsx'));
record('Product analytics', exists('src/services/productAnalyticsService.ts'));
record('Founder metrics API', read('backend/src/routes/beta.ts').includes('/metrics'));
record('Beta invite redeem UI', read('src/app/(tabs)/settings.tsx').includes('BetaInviteRow'));

console.log('\n--- EAS / TestFlight build ---');
const eas = read('eas.json');
record('EAS production profile', eas.includes('"production"') && eas.includes('"distribution": "store"'));
record('EAS testflight profile', eas.includes('"testflight"'));
record('EAS project linked', read('app.config.ts').includes('projectId'));
record('iOS bundle identifier', read('app.config.ts').includes('com.liftflow.app'));
record('Encryption compliance flag', read('app.config.ts').includes('ITSAppUsesNonExemptEncryption'));

console.log('\n--- Documentation & checklists ---');
for (const doc of [
  'docs/TESTFLIGHT_RC_BUILD_CHECKLIST.md',
  'docs/TESTFLIGHT_INTERNAL_TESTING_CHECKLIST.md',
  'docs/DEVICE_TESTING_MATRIX.md',
  'docs/SPRINT86_KNOWN_ISSUES.md',
  'docs/SPRINT86_BLOCKING_ISSUES.md',
  'docs/TESTFLIGHT_SUBSCRIPTION_CHECKLIST.md',
]) {
  record(`Doc: ${doc}`, exists(doc));
}

console.log('\n--- Build ---');
const backendBuild = spawnSync('npm', ['run', 'build'], { cwd: path.join(root, 'backend'), encoding: 'utf8', shell: true });
record('Backend TypeScript build', backendBuild.status === 0);

// Scores
const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
const passWeight = checks.filter((c) => c.pass).reduce((s, c) => s + c.weight, 0);
const overallScore = Math.round((passWeight / totalWeight) * 100);

const opsChecks = checks.filter((c) =>
  ['Migration 015', 'SENTRY_DSN', 'Production health', 'Route: Feedback', 'Route: Events', 'Beta invite'].some((k) =>
    c.name.includes(k),
  ),
);
const opsScore = Math.round(
  (opsChecks.filter((c) => c.pass).reduce((s, c) => s + c.weight, 0) /
    Math.max(1, opsChecks.reduce((s, c) => s + c.weight, 0))) *
    100,
);

const buildChecks = checks.filter((c) => c.name.startsWith('EAS') || c.name.startsWith('Doc:'));
const tfScore = Math.round(
  (buildChecks.filter((c) => c.pass).reduce((s, c) => s + c.weight, 0) /
    Math.max(1, buildChecks.reduce((s, c) => s + c.weight, 0))) *
    100,
);

const passCount = checks.filter((c) => c.pass).length;
const failCount = checks.filter((c) => !c.pass).length;
const overall = failCount === 0 && p0Issues.length === 0 && p1Issues.length === 0;

console.log(`\n=== Sprint 8.6 ${overall ? 'PASS' : 'FAIL'} — ${passCount}/${checks.length} checks ===`);
console.log(`TestFlight Readiness Score: ${tfScore}/100`);
console.log(`Release Candidate Readiness Score: ${opsScore}/100`);
console.log(`Production Readiness Score: ${overallScore}/100`);
console.log(`P0 issues: ${p0Issues.length} · P1 issues: ${p1Issues.length}`);

if (p0Issues.length) {
  console.log('\nP0 blockers:');
  p0Issues.forEach((i) => console.log(`  • ${i}`));
}
if (p1Issues.length) {
  console.log('\nP1 blockers:');
  p1Issues.forEach((i) => console.log(`  • ${i}`));
}

const report = `# Sprint 8.6 — TestFlight Release Candidate Validation Report

**Date:** ${new Date().toISOString().slice(0, 10)}  
**Result:** ${overall ? 'PASS' : 'FAIL'}  
**Checks:** ${passCount}/${checks.length}  

## Scores

| Score | Value | Target |
|-------|-------|--------|
| TestFlight Readiness | **${tfScore}/100** | 100 |
| Release Candidate Readiness | **${opsScore}/100** | 100 |
| Production Readiness | **${overallScore}/100** | 100 |
| P0 issues | **${p0Issues.length}** | 0 |
| P1 issues | **${p1Issues.length}** | 0 |

## Summary

Sprint 8.6 validates TestFlight RC readiness: Sprint 8.5 ops complete, production routes live, core/premium/advanced features, EAS build config, and testing documentation.

**Do not begin closed beta until this report shows PASS with zero P0/P1.**

## Checks

| Check | Result | Detail |
|-------|--------|--------|
${checks.map((c) => `| ${c.name} | ${c.pass ? 'PASS' : 'FAIL'} | ${c.detail || '—'} |`).join('\n')}

## P0 blocking issues

${p0Issues.length ? p0Issues.map((i) => `- ${i}`).join('\n') : '_None_'}

## P1 blocking issues

${p1Issues.length ? p1Issues.map((i) => `- ${i}`).join('\n') : '_None_'}

## Known issues

See [SPRINT86_KNOWN_ISSUES.md](./SPRINT86_KNOWN_ISSUES.md)

## Ops checklist

1. \`npm run migrate:015\`
2. \`npm run seed:beta-invites\`
3. Set Sentry DSNs → \`npm run deploy:render\`
4. \`npm run build:ios:testflight\`
5. Complete [TESTFLIGHT_INTERNAL_TESTING_CHECKLIST.md](./TESTFLIGHT_INTERNAL_TESTING_CHECKLIST.md)
6. Device matrix: [DEVICE_TESTING_MATRIX.md](./DEVICE_TESTING_MATRIX.md)

## Re-run

\`\`\`bash
npm run validate:sprint86
\`\`\`
`;

fs.writeFileSync(path.join(root, 'docs/SPRINT86_VALIDATION_REPORT.md'), report);
console.log('\nReport: docs/SPRINT86_VALIDATION_REPORT.md');

process.exit(overall ? 0 : 1);
