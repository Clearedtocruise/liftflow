#!/usr/bin/env node
/**
 * Sprint 7.9 Final Gate — must PASS before Sprint 8.0 implementation
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const PROD = process.env.EXPO_PUBLIC_API_URL ?? 'https://liftflow-api.onrender.com';
const TEST_USER = '00000000-0000-0000-0000-000000000001';

const checks = [];
function gate(name, pass, detail = '') {
  checks.push({ name, pass, detail });
  console.log(`  ${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`);
}

async function fetchStatus(url, init) {
  try {
    const res = await fetch(url, init);
    return { status: res.status, text: await res.text() };
  } catch (e) {
    return { status: 0, text: e instanceof Error ? e.message : 'fetch failed' };
  }
}

function routeOk(res) {
  return res.status !== 404 && res.status !== 403 && !res.text.includes('Cannot GET') && !res.text.includes('Cannot POST');
}

console.log('=== Sprint 7.9 Final Gate ===\n');

// 1. Production routes
console.log('--- Production deployment ---');
const health = await fetchStatus(`${PROD.replace(/\/$/, '')}/health`);
const healthOk = health.status === 200;
gate('Production /health', healthOk, `HTTP ${health.status}`);

let openaiProd = false;
if (healthOk) {
  try {
    openaiProd = JSON.parse(health.text).openai === 'configured';
  } catch {
    /* ignore */
  }
}

const prodRoutes = [
  ['Recovery intelligence', `${PROD}/api/training/recovery/intelligence?userId=${TEST_USER}`, 'GET'],
  ['Nutrition intelligence', `${PROD}/api/nutrition/intelligence?userId=${TEST_USER}`, 'GET'],
  ['Conversational coach', `${PROD}/api/ai/converse`, 'POST', { userId: TEST_USER, message: 'gate check' }],
  ['Smart progression', `${PROD}/api/training/progression/smart`, 'POST', { userId: TEST_USER, exerciseId: TEST_USER }],
  ['Workout recommendations', `${PROD}/api/training/recommendations/daily?userId=${TEST_USER}`, 'GET'],
];

let prodAllOk = true;
for (const [label, url, method, body] of prodRoutes) {
  const res = await fetchStatus(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const ok = routeOk(res);
  if (!ok) prodAllOk = false;
  gate(`Production ${label}`, ok, `HTTP ${res.status}`);
}

gate('OPENAI_API_KEY on Render', openaiProd, openaiProd ? 'configured' : 'missing — set in .env + deploy:render');

// 2. Migration 010
console.log('\n--- Database ---');
const gym = spawnSync('node', ['scripts/verify-gym-types.mjs'], { cwd: root, encoding: 'utf8', timeout: 60000 });
const gymPass = gym.status === 0;
gate('Migration 010 gym types (5/5)', gymPass, gymPass ? 'applied' : '2/5 — npm run migrate:010');

// 3. Local API (code ready)
console.log('\n--- Local / code ---');
const local = spawnSync('node', ['scripts/test-local-api-routes.mjs'], { cwd: root, encoding: 'utf8', timeout: 120000 });
gate('Local API E2E', local.status === 0);

const registry = fs.readFileSync(path.join(root, 'src/integrations/music/musicProviderRegistry.ts'), 'utf8');
gate('Metro music imports (no .js suffix)', !registry.includes("from './providers/index.js'"));

const backendBuild = spawnSync('npm', ['run', 'build'], { cwd: path.join(root, 'backend'), encoding: 'utf8', shell: true });
gate('Backend TypeScript build', backendBuild.status === 0);

// 4. Sprint 7.9 score
console.log('\n--- Beta readiness ---');
const rc = spawnSync('node', ['scripts/validate-sprint79-rc-hardening.mjs'], { cwd: root, encoding: 'utf8', timeout: 180000 });
const scoreMatch = rc.stdout?.match(/Beta Readiness Score: (\d+)\/100/);
const score = scoreMatch ? Number(scoreMatch[1]) : 0;
gate('Beta Readiness 100/100', score >= 100, `${score}/100`);

const passCount = checks.filter((c) => c.pass).length;
const failCount = checks.filter((c) => !c.pass).length;
const overall = failCount === 0;

console.log(`\n=== GATE ${overall ? 'PASS' : 'FAIL'} — ${passCount}/${checks.length} checks ===`);
if (!overall) {
  console.log('\nBlockers before Sprint 8.0:');
  if (!prodAllOk) console.log('  • git push main + npm run deploy:render');
  if (!gymPass) console.log('  • npm run migrate:010 (requires SUPABASE_ACCESS_TOKEN)');
  if (!openaiProd) console.log('  • Set real OPENAI_API_KEY in .env + deploy:render');
  if (score < 100) console.log(`  • Beta score ${score}/100 — resolve all FAIL areas above`);
}

const report = `# Sprint 7.9 Final Gate Report

**Date:** ${new Date().toISOString().slice(0, 10)}  
**Gate:** ${overall ? 'PASS' : 'FAIL'}  
**Checks:** ${passCount}/${checks.length} PASS  
**Beta Readiness:** ${score}/100  

## Sprint 8.0 blocked

${overall ? 'Gate passed — proceed with Sprint 8.0 implementation.' : '**Do not begin Sprint 8.0 implementation until all checks PASS and score is 100/100.**'}

## Checklist

| Check | Result | Detail |
|-------|--------|--------|
${checks.map((c) => `| ${c.name} | ${c.pass ? 'PASS' : 'FAIL'} | ${c.detail || '—'} |`).join('\n')}

## Resolution steps

1. **Production 404s** — Commit backend + client, \`git push origin main\`, \`npm run deploy:render\`
2. **Migration 010** — Add \`SUPABASE_ACCESS_TOKEN\`, run \`npm run migrate:010\`
3. **OpenAI** — Replace placeholder \`OPENAI_API_KEY\` in \`.env\`, redeploy Render
4. **Metro** — Reload after music import fix (already applied); \`npm run start:expo-go -- --clear\`

## Re-run gate

\`\`\`bash
node scripts/validate-sprint79-final-gate.mjs
\`\`\`
`;
fs.writeFileSync(path.join(root, 'docs/SPRINT79_FINAL_GATE_REPORT.md'), report);
console.log('\nReport: docs/SPRINT79_FINAL_GATE_REPORT.md');

process.exit(overall ? 0 : 1);
