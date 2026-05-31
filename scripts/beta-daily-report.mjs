#!/usr/bin/env node
/**
 * Sprint 8.7 — Daily beta status report
 * Usage: npm run beta:daily-report
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { loadRootEnv } from './lib/migration010.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const API = process.env.EXPO_PUBLIC_API_URL ?? 'https://liftflow-api.onrender.com';

async function founderGet(pathname) {
  const env = loadRootEnv();
  const key = process.env.FOUNDER_ADMIN_KEY ?? env.FOUNDER_ADMIN_KEY ?? '';
  if (!key) throw new Error('FOUNDER_ADMIN_KEY missing in .env');

  const res = await fetch(`${API}${pathname}`, {
    headers: { 'x-founder-admin-key': key, Accept: 'application/json' },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${pathname} HTTP ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

async function main() {
  const date = new Date().toISOString().slice(0, 10);
  console.log(`=== Beta Daily Report — ${date} ===\n`);

  const [health, soak, retention, blockers, feedback] = await Promise.all([
    fetch(`${API}/health`).then((r) => r.json()),
    founderGet('/api/beta/soak-status').catch((e) => ({ error: e.message })),
    founderGet('/api/beta/retention').catch((e) => ({ error: e.message })),
    founderGet('/api/beta/launch-blockers').catch((e) => ({ error: e.message })),
    founderGet('/api/feedback/summary').catch((e) => ({ error: e.message })),
  ]);

  const p0 = blockers.p0Count ?? 0;
  const p1 = blockers.p1Count ?? 0;
  const wave1 = blockers.wave1Authorized ? '**AUTHORIZED**' : '**NOT AUTHORIZED**';
  const expand50 = blockers.expandTo50Recommended ? '**RECOMMENDED**' : 'Not yet';

  const report = `# Beta Daily Status Report

**Date:** ${date}  
**Phase:** Internal soak (Sprint 8.7)  
**P0:** ${p0} · **P1:** ${p1}  
**Wave 1 (LIFTFLOW-BETA25):** ${wave1}  
**Expand to 50:** ${expand50}

---

## Infrastructure

| System | Status |
|--------|--------|
| Render API | ${health.status === 'ok' ? '✓' : '✗'} ${health.status ?? 'unknown'} |
| OpenAI | ${health.openai ?? '—'} |
| Supabase | ${health.supabase ?? '—'} |
| Backend Sentry | ${health.sentry ?? '—'} |

---

## Internal testers

| Metric | Value |
|--------|-------|
| Registered internal | ${soak.internalTesters?.registered ?? '—'} / ${soak.internalTesters?.target?.min ?? 5}–${soak.internalTesters?.target?.max ?? 10} |
| LIFTFLOW-INTERNAL uses | ${soak.internalTesters?.inviteUses ?? '—'} / ${soak.internalTesters?.inviteMax ?? 10} |
| Open feedback | ${soak.openFeedback ?? feedback.open ?? '—'} |

---

## Soak events (7d)

| Feature | Events | Unique users | Status |
|---------|--------|--------------|--------|
${(soak.soakEvents ?? [])
  .map(
    (s) =>
      `| ${s.event.replace(/_/g, ' ')} | ${s.count7d} | ${s.uniqueUsers7d} | ${s.passed ? '✓' : '—'} |`,
  )
  .join('\n')}

---

## Retention & conversion

| Metric | Value |
|--------|-------|
| DAU | ${retention.retention?.dau ?? '—'} |
| WAU | ${retention.retention?.wau ?? '—'} |
| 14d retention | ${retention.retention?.retentionRate14d ?? '—'}% |
| Onboarding completion | ${retention.retention?.onboardingCompletionRate ?? '—'}% |
| Pro conversion | ${retention.conversion?.conversionRate ?? '—'}% |
| Trial conversion | ${retention.conversion?.trialConversionRate ?? '—'}% |

---

## Monitoring (24h)

| Signal | Value |
|--------|-------|
| App events | ${retention.monitoring?.eventsLast24h ?? '—'} |
| Feedback submissions | ${retention.monitoring?.feedbackLast24h ?? '—'} |
| RevenueCat events | ${JSON.stringify(retention.monitoring?.revenueCatEvents24h ?? {})} |
| OpenAI configured | ${retention.monitoring?.openAiConfigured ? 'yes' : 'no'} |

---

## Launch blockers

${(blockers.blockers ?? []).length ? blockers.blockers.map((b) => `- **[${b.severity}]** ${b.issue}`).join('\n') : '_None_'}

---

## Actions today

- [ ] Review Sentry dashboard (mobile + backend)
- [ ] Triage open feedback in Supabase \`beta_feedback\`
- [ ] Founder dashboard: ${API}/admin/founder
- [ ] Update soak tracker: [SPRINT87_INTERNAL_SOAK_TRACKER.md](./SPRINT87_INTERNAL_SOAK_TRACKER.md)

---

## Re-run

\`\`\`bash
npm run beta:daily-report
\`\`\`
`;

  const reportsDir = path.join(root, 'docs/reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  const outPath = path.join(reportsDir, `BETA_DAILY_${date}.md`);
  fs.writeFileSync(outPath, report);

  const blockersPath = path.join(root, 'docs/SPRINT87_LAUNCH_BLOCKERS.md');
  fs.writeFileSync(
    blockersPath,
    `# Sprint 8.7 — Launch Blockers

**Updated:** ${date}  
**P0:** ${p0} · **P1:** ${p1}  
**Wave 1 authorization:** ${wave1.replace(/\*/g, '')}

${(blockers.blockers ?? []).length ? blockers.blockers.map((b) => `- **[${b.severity}]** ${b.status.toUpperCase()} — ${b.issue}`).join('\n') : '_No active blockers_'}

## Expand to 50 users

**Recommendation:** ${expand50.replace(/\*/g, '')}

Criteria: zero P0, zero recurring P1, internal soak complete, crash-free >99%.

Auto-generated by \`npm run beta:daily-report\`.
`,
  );

  console.log(`Report: ${outPath}`);
  console.log(`Blockers: docs/SPRINT87_LAUNCH_BLOCKERS.md`);
  console.log(`P0: ${p0} · P1: ${p1} · Wave 1: ${wave1.replace(/\*/g, '')}`);
}

main().catch((e) => {
  console.error('REPORT FAILED:', e.message);
  console.error('Deploy backend with Sprint 8.7 routes: npm run deploy:render');
  process.exit(1);
});
