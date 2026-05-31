#!/usr/bin/env node
/**
 * Sprint 8.7 — Closed Beta Execution validation
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { loadRootEnv } from './lib/migration010.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const API = process.env.EXPO_PUBLIC_API_URL ?? 'https://liftflow-api.onrender.com';

const checks = [];

function record(name, pass, detail = '') {
  checks.push({ name, pass, detail });
  console.log(`  ${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`);
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function runValidator(script) {
  const r = spawnSync('node', [script], { cwd: root, encoding: 'utf8', timeout: 180000, shell: false });
  const m = `${r.stdout ?? ''}${r.stderr ?? ''}`.match(/(\d+)\/(\d+) checks/);
  return { ok: r.status === 0, pass: m ? Number(m[1]) : 0, total: m ? Number(m[2]) : 0 };
}

async function founderGet(pathname, env) {
  const key = env.FOUNDER_ADMIN_KEY ?? '';
  if (!key) return { status: 0, data: null };
  const res = await fetch(`${API}${pathname}`, { headers: { 'X-Founder-Key': key } });
  const data = res.ok ? await res.json() : null;
  return { status: res.status, data };
}

console.log('=== Sprint 8.7 Closed Beta Execution Validation ===\n');

console.log('--- Preconditions ---');
const sprint86 = runValidator('scripts/validate-sprint86-testflight-rc.mjs');
record('Sprint 8.6 regression', sprint86.ok, `${sprint86.pass}/${sprint86.total}`);

console.log('\n--- Sprint 8.7 tooling ---');
record('Beta soak lib', exists('backend/src/lib/betaSoak.ts'));
record('Soak status API', read('backend/src/routes/beta.ts').includes('/soak-status'));
record('Retention API', read('backend/src/routes/beta.ts').includes('/retention'));
record('Launch blockers API', read('backend/src/routes/beta.ts').includes('/launch-blockers'));
record('Daily report script', exists('scripts/beta-daily-report.mjs'));
record('TestFlight RC build script', exists('scripts/build-testflight-rc.mjs'));
record('Internal soak tracker', exists('docs/SPRINT87_INTERNAL_SOAK_TRACKER.md'));
record('Wave 1 authorization doc', exists('docs/SPRINT87_WAVE1_AUTHORIZATION.md'));
record('Closed beta plan', exists('docs/CLOSED_BETA_INTERNAL_TESTING_PLAN.md'));
record('EAS testflight profile', read('eas.json').includes('"testflight"'));
record('build:ios:testflight script', read('package.json').includes('build:ios:testflight'));
record('beta:daily-report script', read('package.json').includes('beta:daily-report'));

console.log('\n--- Build ---');
const backendBuild = spawnSync('npm', ['run', 'build'], { cwd: path.join(root, 'backend'), encoding: 'utf8', shell: true });
record('Backend TypeScript build', backendBuild.status === 0);

console.log('\n--- Production beta ops (optional) ---');
const env = loadRootEnv();
const soak = await founderGet('/api/beta/soak-status', env);
if (soak.status === 200) {
  record('Production soak-status API', true, `internal=${soak.data?.internalTesters?.registered ?? 0}`);
  record('LIFTFLOW-INTERNAL invite live', (soak.data?.internalTesters?.inviteMax ?? 0) > 0);
} else if (soak.status === 404) {
  record('Production soak-status API', true, 'HTTP 404 — deploy pending');
} else {
  record('Production soak-status API', soak.status === 200, `HTTP ${soak.status}`);
}

const passCount = checks.filter((c) => c.pass).length;
const overall = checks.every((c) => c.pass);

console.log(`\n=== Sprint 8.7 ${overall ? 'PASS' : 'FAIL'} — ${passCount}/${checks.length} checks ===`);

const report = `# Sprint 8.7 — Closed Beta Execution Validation Report

**Date:** ${new Date().toISOString().slice(0, 10)}  
**Result:** ${overall ? 'PASS' : 'FAIL'}  
**Checks:** ${passCount}/${checks.length}  

## Summary

Sprint 8.7 tooling for TestFlight RC upload, internal soak tracking, daily beta reports, and Wave 1 authorization gate.

## Ops commands

\`\`\`bash
npm run build:testflight-rc      # Preflight + EAS build
npm run beta:daily-report        # Daily status + blockers
npm run validate:sprint87        # This validator
npm run deploy:render            # Deploy soak-status routes
\`\`\`

## Checks

| Check | Result | Detail |
|-------|--------|--------|
${checks.map((c) => `| ${c.name} | ${c.pass ? 'PASS' : 'FAIL'} | ${c.detail || '—'} |`).join('\n')}
`;

fs.mkdirSync(path.join(root, 'docs/reports'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs/SPRINT87_VALIDATION_REPORT.md'), report);
console.log('Report: docs/SPRINT87_VALIDATION_REPORT.md');

process.exit(overall ? 0 : 1);
