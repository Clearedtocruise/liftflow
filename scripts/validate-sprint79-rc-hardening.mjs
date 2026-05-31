#!/usr/bin/env node
/**
 * Sprint 7.9 — Release Candidate Hardening & Beta Readiness (target 100/100)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const PROD_API = process.env.EXPO_PUBLIC_API_URL ?? 'https://liftflow-api.onrender.com';
const USE_LOCAL_API = process.env.BETA_USE_LOCAL !== '0';

const areas = [];
function area(name, status, detail = '') {
  areas.push({ name, status, detail });
  const icon = status === 'PASS' ? '✓' : status === 'PARTIAL' ? '◐' : '✗';
  console.log(`  ${icon} ${name}${detail ? ' — ' + detail : ''}`);
}

function fileExists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function runValidator(script) {
  const r = spawnSync('node', [script], { cwd: root, encoding: 'utf8', timeout: 180000 });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  const m = out.match(/Summary: (\d+)\/(\d+) PASS/) || out.match(/(\d+)\/(\d+) PASS/);
  if (m) return { ok: r.status === 0, pass: Number(m[1]), total: Number(m[2]), out };
  return { ok: r.status === 0, pass: r.status === 0 ? 1 : 0, total: 1, out };
}

async function fetchStatus(url, init) {
  try {
    const res = await fetch(url, init);
    return { ok: res.ok, status: res.status, text: await res.text() };
  } catch (e) {
    return { ok: false, status: 0, text: e instanceof Error ? e.message : 'fetch failed' };
  }
}

function routeDeployed(res) {
  return res.status !== 404 && !res.text.includes('Cannot GET') && !res.text.includes('Cannot POST');
}

console.log('=== Sprint 7.9 Release Candidate Hardening ===\n');

console.log('--- Sprint regression suite ---');
const sprintScripts = [
  ['Voice (7.0)', 'scripts/validate-sprint70-voice.mjs'],
  ['Recovery (7.2)', 'scripts/validate-sprint72-recovery.mjs'],
  ['Recommendations (7.3)', 'scripts/validate-sprint73-recommendations.mjs'],
  ['Progression (7.1)', 'scripts/validate-sprint71-progression.mjs'],
  ['Health (7.4)', 'scripts/validate-sprint74-health.mjs'],
  ['Nutrition (7.5)', 'scripts/validate-sprint75-nutrition.mjs'],
  ['AI Coach (7.6)', 'scripts/validate-sprint76-conversational-coach.mjs'],
  ['Peak Music (7.X)', 'scripts/validate-sprint7x-peak-music.mjs'],
];

for (const [label, script] of sprintScripts) {
  const r = runValidator(script);
  area(`Sprint: ${label}`, r.ok ? 'PASS' : 'FAIL', `${r.pass}/${r.total}`);
}

console.log('\n--- Sprint 7.8 FAIL remediation ---');

const progFull =
  fileExists('src/services/progressionService.ts') &&
  read('backend/src/routes/training.ts').includes('/progression/smart') &&
  read('src/app/(tabs)/workout.tsx').includes('SmartProgressionCard');
area('Smart progression (7.1 complete)', progFull ? 'PASS' : 'FAIL');

const gymVerify = spawnSync('node', ['scripts/verify-gym-types.mjs'], { cwd: root, encoding: 'utf8', timeout: 60000 });
const gymPass = gymVerify.status === 0;
area(
  'Migration 010 gym types',
  gymPass ? 'PASS' : 'FAIL',
  gymPass ? '5/5 types' : 'Run node scripts/apply-migration-010.mjs',
);

console.log('\n--- API route verification ---');

if (USE_LOCAL_API) {
  const local = runValidator('scripts/test-local-api-routes.mjs');
  area('Local API E2E (all intelligence routes)', local.ok ? 'PASS' : 'FAIL');
} else {
  area('Local API E2E', 'PARTIAL', 'skipped — set BETA_USE_LOCAL=1');
}

const testUser = '00000000-0000-0000-0000-000000000001';
const prodRoutes = [
  ['Recovery intelligence', `${PROD_API}/api/training/recovery/intelligence?userId=${testUser}`, 'GET'],
  ['Nutrition intelligence', `${PROD_API}/api/nutrition/intelligence?userId=${testUser}`, 'GET'],
  ['Conversational coach', `${PROD_API}/api/ai/converse`, 'POST', { userId: testUser, message: 'test' }],
  ['Smart progression', `${PROD_API}/api/training/progression/smart`, 'POST', { userId: testUser, exerciseId: testUser }],
];

let prodDeployed = true;
for (const [label, url, method, body] of prodRoutes) {
  const res = await fetchStatus(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const ok = label === 'Conversational coach' ? res.status === 200 : routeDeployed(res);
  if (!ok) prodDeployed = false;
  area(`Production: ${label}`, ok ? 'PASS' : 'FAIL', ok ? `HTTP ${res.status}` : 'Push main + npm run deploy:render');
}

const health = await fetchStatus(`${PROD_API.replace(/\/$/, '')}/health`);
area('Production health', health.ok ? 'PASS' : 'FAIL', `HTTP ${health.status}`);

let openaiProd = false;
if (health.ok) {
  try {
    const data = JSON.parse(health.text);
    openaiProd = data.openai === 'configured';
    area('Production OpenAI', openaiProd ? 'PASS' : 'PARTIAL', `openai=${data.openai}`);
  } catch {
    area('Production OpenAI', 'PARTIAL', 'unparseable health JSON');
  }
}

console.log('\n--- Integration & HealthKit ---');
const integration = runValidator('scripts/test-integration-intelligence.mjs');
area('Cross-feature intelligence integration', integration.ok ? 'PASS' : 'FAIL');

const healthkit = runValidator('scripts/verify-healthkit-dev-build.mjs');
area('HealthKit dev build (static)', healthkit.ok ? 'PASS' : 'FAIL');

console.log('\n--- Build & release artifacts ---');
const backendBuild = spawnSync('npm', ['run', 'build'], { cwd: path.join(root, 'backend'), encoding: 'utf8', shell: true });
area('Backend TypeScript build', backendBuild.status === 0 ? 'PASS' : 'FAIL');
area('Release checklist doc', fileExists('docs/RELEASE_CHECKLIST.md') ? 'PASS' : 'FAIL');

console.log('\n--- Beta readiness score ---');
const weights = { PASS: 1, PARTIAL: 0.5, FAIL: 0 };
const score = areas.reduce((sum, a) => sum + weights[a.status], 0);
const maxScore = areas.length;
const pct = Math.round((score / maxScore) * 100);

const passCount = areas.filter((a) => a.status === 'PASS').length;
const partialCount = areas.filter((a) => a.status === 'PARTIAL').length;
const failCount = areas.filter((a) => a.status === 'FAIL').length;

console.log(`  Areas: ${passCount} PASS · ${partialCount} PARTIAL · ${failCount} FAIL (${areas.length} total)`);
console.log(`  Beta Readiness Score: ${pct}/100`);

const blockers = [];
if (!progFull) blockers.push('Smart progression incomplete');
if (!gymPass) blockers.push('Apply migration 010 — node scripts/apply-migration-010.mjs');
if (!prodDeployed) blockers.push('Production API stale — git push main then npm run deploy:render');
if (!openaiProd) blockers.push('Set OPENAI_API_KEY on Render (and .env for local AI E2E)');

console.log('\n--- Release blockers ---');
if (blockers.length === 0) console.log('  None — release candidate ready');
else blockers.forEach((b) => console.log(`  • ${b}`));

const reportPath = path.join(root, 'docs/BETA_READINESS_SPRINT79.md');
const report = `# Sprint 7.9 — Beta Readiness Report

**Date:** ${new Date().toISOString().slice(0, 10)}  
**Score:** ${pct}/100  
**Code RC Score:** ${Math.round((areas.filter((a) => !a.name.startsWith('Production:')).reduce((s, a) => s + weights[a.status], 0) / areas.filter((a) => !a.name.startsWith('Production:')).length) * 100)}/100 (excludes production deploy gate)  
**Status:** ${pct >= 100 && failCount === 0 ? 'RELEASE CANDIDATE' : pct >= 90 ? 'NEAR RC' : 'NOT READY'}

## Summary

| Metric | Value |
|--------|-------|
| PASS | ${passCount} |
| PARTIAL | ${partialCount} |
| FAIL | ${failCount} |
| Total areas | ${areas.length} |

## Sprint 7.8 FAIL items — status

| Item | Status |
|------|--------|
| Production recovery/nutrition/converse 404 | ${prodDeployed ? 'FIXED' : 'FAIL — git push main + deploy:render'} |
| Smart progression (7.1) | ${progFull ? 'COMPLETE' : 'INCOMPLETE'} |
| Migration 010 gym types | ${gymPass ? 'APPLIED' : 'PENDING — npm run migrate:010'} |
| OpenAI on production | ${openaiProd ? 'CONFIGURED' : 'MISSING — set real OPENAI_API_KEY in .env + deploy'} |

## Area results

${areas.map((a) => `- **${a.name}:** ${a.status}${a.detail ? ` — ${a.detail}` : ''}`).join('\n')}

## Blockers

${blockers.length ? blockers.map((b) => `- ${b}`).join('\n') : '- None'}

## Commands

\`\`\`bash
npm run validate:sprint79
npm run migrate:010
npm run test:local-api
npm run deploy:render
\`\`\`

See [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) for TestFlight and App Store steps.
`;
fs.writeFileSync(reportPath, report);
console.log(`\nReport written: docs/BETA_READINESS_SPRINT79.md`);
console.log(`\n=== Sprint 7.9 Summary: ${passCount}/${areas.length} PASS · Score ${pct}/100 ===`);

process.exit(failCount > 0 || pct < 100 ? 1 : 0);
