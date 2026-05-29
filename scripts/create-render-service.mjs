#!/usr/bin/env node
/**
 * Create liftflow-api on Render via REST API.
 * Requires RENDER_API_KEY in .env (https://dashboard.render.com/u/settings#api-keys)
 *
 * Usage: node scripts/create-render-service.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

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

const env = loadEnv();
const apiKey = process.env.RENDER_API_KEY ?? env.RENDER_API_KEY;
const ownerId = process.env.RENDER_OWNER_ID ?? env.RENDER_OWNER_ID;

if (!apiKey) {
  console.error('Missing RENDER_API_KEY.');
  console.error('Add to .env: RENDER_API_KEY=rnd_...');
  console.error('Create at: https://dashboard.render.com/u/settings#api-keys');
  console.error('\nOr deploy manually:');
  console.error('https://render.com/deploy?repo=https://github.com/Clearedtocruise/liftflow');
  process.exit(1);
}

async function api(path, options = {}) {
  const res = await fetch(`https://api.render.com/v1${path}`, {
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
  if (!res.ok) throw new Error(`${res.status} ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  return body;
}

async function getOwnerId() {
  if (ownerId) return ownerId;
  const owners = await api('/owners?limit=20');
  const list = Array.isArray(owners) ? owners : owners?.data ?? [];
  const entry = list[0];
  const id = entry?.owner?.id ?? entry?.id;
  if (!id) throw new Error('No Render workspace found. Set RENDER_OWNER_ID in .env');
  return id;
}

async function findExisting() {
  const services = await api('/services?limit=50');
  const list = Array.isArray(services) ? services : services?.data ?? [];
  return list.find((s) => (s.service?.name ?? s.name) === 'liftflow-api');
}

async function main() {
  const existing = await findExisting();
  if (existing) {
    const svc = existing.service ?? existing;
    console.log('Service already exists:', svc.id);
    console.log('URL:', svc.serviceDetails?.url ?? `https://${svc.name}.onrender.com`);
    return;
  }

  const oid = await getOwnerId();
  const payload = {
    type: 'web_service',
    name: 'liftflow-api',
    ownerId: oid,
    repo: 'https://github.com/Clearedtocruise/liftflow',
    branch: 'main',
    rootDir: 'backend',
    autoDeploy: 'yes',
    envVars: [
      { key: 'NODE_ENV', value: 'production' },
      { key: 'SUPABASE_URL', value: env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL ?? '' },
      { key: 'SUPABASE_SERVICE_ROLE_KEY', value: env.SUPABASE_SERVICE_ROLE_KEY ?? '' },
      { key: 'OPENAI_API_KEY', value: env.OPENAI_API_KEY ?? '' },
    ].filter((v) => v.value),
    serviceDetails: {
      runtime: 'node',
      plan: 'free',
      env: 'node',
      healthCheckPath: '/health',
      envSpecificDetails: {
        buildCommand: 'npm install && npm run build',
        startCommand: 'npm start',
      },
    },
  };

  const created = await api('/services', { method: 'POST', body: JSON.stringify(payload) });
  const svc = created.service ?? created;
  console.log('Created service:', svc.id);
  console.log('URL:', svc.serviceDetails?.url ?? 'https://liftflow-api.onrender.com');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
