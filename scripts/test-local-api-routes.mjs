#!/usr/bin/env node
/**
 * Start local backend and verify Sprint 7.2–7.6 intelligence routes + progression.
 * Usage: node scripts/test-local-api-routes.mjs
 */
import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const backendDir = path.join(root, 'backend');
const PORT = Number(process.env.LOCAL_API_PORT ?? 3099);
const TEST_USER = '00000000-0000-0000-0000-000000000001';

function loadEnv() {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(envPath, 'utf8')
      .split('\n')
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  );
}

async function fetchStatus(url, init) {
  try {
    const res = await fetch(url, init);
    return { ok: res.ok, status: res.status, text: await res.text() };
  } catch (e) {
    return { ok: false, status: 0, text: e instanceof Error ? e.message : 'fetch failed' };
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHealth(base, attempts = 30) {
  for (let i = 0; i < attempts; i++) {
    const h = await fetchStatus(`${base}/health`);
    if (h.ok) return h;
    await sleep(500);
  }
  throw new Error('Local API failed to start');
}

async function main() {
  console.log('=== Local API Route Verification ===\n');

  const build = spawnSync('npm', ['run', 'build'], { cwd: backendDir, encoding: 'utf8', shell: true });
  if (build.status !== 0) {
    console.error(build.stderr || build.stdout);
    process.exit(1);
  }

  const envFile = loadEnv();
  const child = spawn('node', ['dist/index.js'], {
    cwd: backendDir,
    env: {
      ...process.env,
      PORT: String(PORT),
      SUPABASE_URL: envFile.SUPABASE_URL ?? envFile.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: envFile.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
      OPENAI_API_KEY: envFile.OPENAI_API_KEY ?? process.env.OPENAI_API_KEY,
    },
    stdio: 'pipe',
  });

  const base = `http://127.0.0.1:${PORT}`;
  let exitCode = 0;

  try {
    const health = await waitForHealth(base);
    console.log(`✓ Health — HTTP ${health.status}`);

    const routes = [
      ['GET', `/api/training/recovery/intelligence?userId=${TEST_USER}`, null, [200, 500]],
      ['GET', `/api/nutrition/intelligence?userId=${TEST_USER}`, null, [200, 500]],
      ['POST', '/api/ai/converse', { userId: TEST_USER, message: 'What should I train today?' }, [200, 500]],
      ['GET', `/api/training/recommendations/daily?userId=${TEST_USER}`, null, [200, 500]],
      ['POST', '/api/training/progression/smart', { userId: TEST_USER, exerciseId: TEST_USER }, [200, 500]],
      ['POST', '/api/ai/coach', { userId: TEST_USER, message: 'test' }, [200]],
    ];

    for (const [method, path, body, okStatuses] of routes) {
      const res = await fetchStatus(`${base}${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const routeOk = okStatuses.includes(res.status) && !res.text.includes('Cannot GET') && !res.text.includes('Cannot POST');
      console.log(`${routeOk ? '✓' : '✗'} ${method} ${path} — HTTP ${res.status}`);
      if (!routeOk) exitCode = 1;
    }

    const healthJson = JSON.parse(health.text);
    const openaiOk = healthJson.openai === 'configured';
    console.log(`${openaiOk ? '✓' : '◐'} OpenAI — ${healthJson.openai}${openaiOk ? '' : ' (set OPENAI_API_KEY in .env for full AI)'}`);
  } finally {
    child.kill('SIGTERM');
  }

  process.exit(exitCode);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
