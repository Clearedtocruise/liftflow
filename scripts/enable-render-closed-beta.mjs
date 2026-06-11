#!/usr/bin/env node
/**
 * Enable closed-beta API access on Render (bypass Pro subscription gate for all users).
 *
 * Requires RENDER_API_KEY in .env:
 *   https://dashboard.render.com/u/settings#api-keys
 *
 * Usage: node scripts/enable-render-closed-beta.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const SERVICE_NAME = 'liftflow-api';
const PROBE_USER = '00000000-0000-0000-0000-000000000001';

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

async function api(apiKey, apiPath, options = {}) {
  const res = await fetch(`https://api.render.com/v1${apiPath}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(options.headers ?? {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`${res.status} ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }
  return body;
}

async function findService(apiKey) {
  let cursor;
  do {
    const q = cursor ? `/services?limit=50&cursor=${cursor}` : '/services?limit=50';
    const page = await api(apiKey, q);
    const list = Array.isArray(page) ? page : [];
    for (const item of list) {
      const svc = item.service ?? item;
      if (svc.name === SERVICE_NAME) return svc;
    }
    cursor = list[list.length - 1]?.cursor;
  } while (cursor);
  return null;
}

async function probeProGate() {
  const res = await fetch(
    `https://liftflow-api.onrender.com/api/training/recovery/intelligence?userId=${PROBE_USER}`,
  );
  return res.status;
}

async function main() {
  console.log('=== Enable Render Closed Beta (API Pro bypass) ===\n');

  const before = await probeProGate();
  console.log(`Pro gate probe (before): HTTP ${before}${before === 403 ? ' — gate ON' : before === 200 ? ' — gate OFF' : ''}`);

  if (before === 200) {
    console.log('\nClosed beta API access is already enabled.');
    return;
  }

  const env = loadEnv();
  const apiKey = process.env.RENDER_API_KEY ?? env.RENDER_API_KEY;
  if (!apiKey) {
    console.error('\nBLOCKER: Missing RENDER_API_KEY in .env');
    console.error('\nManual fix (works immediately with current production backend):');
    console.error('  1. Open https://dashboard.render.com → liftflow-api → Environment');
    console.error('  2. Add SUBSCRIPTION_GATE_DISABLED = 1');
    console.error('  3. Save and trigger Manual Deploy');
    console.error('\nAfter deploy, Pro routes (coach, recovery, nutrition intel) work for all logged-in users.');
    process.exit(1);
  }

  const service = await findService(apiKey);
  if (!service) throw new Error(`Service ${SERVICE_NAME} not found`);

  const existing = await api(apiKey, `/services/${service.id}/env-vars`);
  const vars = Array.isArray(existing) ? existing.map((e) => e.envVar ?? e) : [];
  const merged = new Map(vars.map((v) => [v.key, v.value]));
  merged.set('SUBSCRIPTION_GATE_DISABLED', '1');
  merged.set('CLOSED_BETA', '1');

  await api(apiKey, `/services/${service.id}/env-vars`, {
    method: 'PUT',
    body: JSON.stringify([...merged.entries()].map(([key, value]) => ({ key, value }))),
  });
  console.log('Environment updated. Triggering deploy...');

  await fetch(`https://api.render.com/v1/services/${service.id}/deploys`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ clearCache: 'clear' }),
  });

  console.log('Deploy started. Waiting for Pro gate to open...');
  for (let i = 1; i <= 24; i++) {
    await new Promise((r) => setTimeout(r, 15_000));
    const status = await probeProGate();
    console.log(`  probe ${i}/24: HTTP ${status}`);
    if (status === 200) {
      console.log('\nSUCCESS: Closed beta API access is enabled.');
      return;
    }
  }

  console.warn('\nDeploy may still be in progress. Re-run this script or check Render dashboard.');
}

main().catch((e) => {
  console.error('\nFAILED:', e.message);
  process.exit(1);
});
