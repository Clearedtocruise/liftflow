#!/usr/bin/env node
/**
 * OpenAI configuration verification — local .env, Render env, /health, AI endpoints
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadRootEnv } from './lib/migration010.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const PROD = process.env.EXPO_PUBLIC_API_URL ?? 'https://liftflow-api.onrender.com';
const TEST_USER = '00000000-0000-0000-0000-000000000001';

function isValidOpenAiKey(key) {
  return Boolean(key && key.startsWith('sk-') && !key.includes('your-openai') && key.length > 20);
}

async function fetchJson(url, init) {
  try {
    const res = await fetch(url, init);
    const text = await res.text();
    let body;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { status: res.status, body, text };
  } catch (e) {
    return { status: 0, body: null, text: e instanceof Error ? e.message : 'fetch failed' };
  }
}

const checks = [];
function record(name, pass, detail = '') {
  checks.push({ name, pass, detail });
  console.log(`  ${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`);
}

console.log('=== OpenAI Configuration Verification ===\n');

const env = loadRootEnv();
const localKey = process.env.OPENAI_API_KEY ?? env.OPENAI_API_KEY ?? '';

console.log('--- Local ---');
record('.env OPENAI_API_KEY', isValidOpenAiKey(localKey), isValidOpenAiKey(localKey) ? 'valid sk-* key' : 'missing or placeholder');

console.log('\n--- Render ---');
const renderKey = env.RENDER_API_KEY;
if (renderKey) {
  const res = await fetch('https://api.render.com/v1/services/srv-d8crebn40ujc73aoqib0/env-vars', {
    headers: { Authorization: `Bearer ${renderKey}` },
  });
  const vars = await res.json();
  const openaiVar = (Array.isArray(vars) ? vars : []).find((x) => (x.envVar ?? x).key === 'OPENAI_API_KEY');
  const renderVal = openaiVar?.envVar?.value ?? openaiVar?.value ?? '';
  record('Render OPENAI_API_KEY env var', isValidOpenAiKey(renderVal), renderVal ? 'set' : 'not configured on Render');
} else {
  record('Render OPENAI_API_KEY env var', false, 'RENDER_API_KEY missing');
}

console.log('\n--- Production /health ---');
const health = await fetchJson(`${PROD.replace(/\/$/, '')}/health`);
const openaiHealth = health.body?.openai === 'configured';
record('/health openai=configured', openaiHealth, health.body?.openai ?? `HTTP ${health.status}`);

console.log('\n--- AI endpoints (production) ---');
const converse = await fetchJson(`${PROD}/api/ai/converse`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: TEST_USER, message: 'What should I eat after leg day?', detailLevel: 'short' }),
});
const converseAnswer = converse.body?.answer ?? converse.body?.response;
record(
  '/api/ai/converse',
  converse.status === 200 && typeof converseAnswer === 'string' && converseAnswer.length > 0,
  `HTTP ${converse.status}${converseAnswer ? ' — coach answer' : converse.body?.message ?? ''}`,
);

const coach = await fetchJson(`${PROD}/api/ai/coach`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: TEST_USER, message: 'How is my recovery?', context: 'recovery' }),
});
record('/api/ai/coach (recovery)', coach.status === 200, `HTTP ${coach.status}`);

const tts = await fetchJson(`${PROD}/api/ai/tts`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: 'Rest thirty seconds.' }),
});
record(
  '/api/ai/tts (voice coaching)',
  tts.status === 200 || tts.status === 503,
  tts.status === 200 ? 'audio returned' : tts.status === 503 ? '503 fallback (no OpenAI TTS)' : `HTTP ${tts.status}`,
);

console.log('\n--- Local backend (if key in .env) ---');
if (isValidOpenAiKey(localKey)) {
  const local = spawnSync('node', ['scripts/test-local-api-routes.mjs'], { cwd: root, encoding: 'utf8', timeout: 120000 });
  const localOpenai = (local.stdout ?? '').includes('OpenAI — configured');
  record('Local API OpenAI loaded', localOpenai, localOpenai ? 'configured' : 'missing on local');
} else {
  record('Local API OpenAI loaded', false, 'skipped — no valid local key');
}

console.log('\n--- Fix ---');
if (!isValidOpenAiKey(localKey)) {
  console.log('  1. Set OPENAI_API_KEY=sk-... in .env');
  console.log('  2. npm run deploy:render');
  console.log('  3. Confirm /health → "openai": "configured"');
}

const passCount = checks.filter((c) => c.pass).length;
console.log(`\n=== OpenAI Verification: ${passCount}/${checks.length} PASS ===`);

const reportPath = path.join(root, 'docs/OPENAI_VERIFICATION_REPORT.md');
fs.writeFileSync(
  reportPath,
  `# OpenAI Verification Report\n\n**Date:** ${new Date().toISOString().slice(0, 10)}  \n**Score:** ${passCount}/${checks.length} PASS\n\n| Check | Result | Detail |\n|-------|--------|--------|\n${checks.map((c) => `| ${c.name} | ${c.pass ? 'PASS' : 'FAIL'} | ${c.detail || '—'} |`).join('\n')}\n`,
);
console.log(`Report: docs/OPENAI_VERIFICATION_REPORT.md`);

process.exit(passCount === checks.length ? 0 : 1);
