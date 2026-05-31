#!/usr/bin/env node
/**
 * Create/update liftflow-api on Render, set env vars, deploy, verify /health.
 *
 * Requires RENDER_API_KEY in .env:
 *   https://dashboard.render.com/u/settings#api-keys
 *
 * Usage: node scripts/deploy-render.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const SERVICE_NAME = 'liftflow-api';
const HEALTH_URL = 'https://liftflow-api.onrender.com/health';
const REPO = 'https://github.com/Clearedtocruise/liftflow';
const ROOT_DIR = 'backend';
const BUILD_COMMAND = 'npm install --include=dev && npm run build';
const START_COMMAND = 'npm start';

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

if (!apiKey) {
  console.error('BLOCKER: Missing RENDER_API_KEY in .env');
  console.error('1. Create key: https://dashboard.render.com/u/settings#api-keys');
  console.error('2. Add to .env: RENDER_API_KEY=rnd_...');
  console.error('3. Re-run: npm run deploy:render');
  process.exit(1);
}

function buildEnvVars() {
  const openai = env.OPENAI_API_KEY ?? '';
  const vars = [
    { key: 'NODE_ENV', value: 'production' },
    { key: 'SUPABASE_URL', value: env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL ?? '' },
    { key: 'SUPABASE_SERVICE_ROLE_KEY', value: env.SUPABASE_SERVICE_ROLE_KEY ?? '' },
  ];
  if (openai && openai.startsWith('sk-') && !openai.includes('your-openai') && openai.length > 20) {
    vars.push({ key: 'OPENAI_API_KEY', value: openai });
  }
  const accessToken = env.SUPABASE_ACCESS_TOKEN ?? '';
  if (accessToken) vars.push({ key: 'SUPABASE_ACCESS_TOKEN', value: accessToken });
  const databaseUrl = env.DATABASE_URL ?? '';
  if (databaseUrl) vars.push({ key: 'DATABASE_URL', value: databaseUrl });
  const founderKey = env.FOUNDER_ADMIN_KEY ?? process.env.FOUNDER_ADMIN_KEY ?? '';
  if (founderKey) vars.push({ key: 'FOUNDER_ADMIN_KEY', value: founderKey });
  const stravaId = env.STRAVA_CLIENT_ID ?? '';
  const stravaSecret = env.STRAVA_CLIENT_SECRET ?? '';
  const stravaRedirect = env.STRAVA_REDIRECT_URI ?? 'https://liftflow-api.onrender.com/api/integrations/strava/callback';
  if (stravaId) vars.push({ key: 'STRAVA_CLIENT_ID', value: stravaId });
  if (stravaSecret) vars.push({ key: 'STRAVA_CLIENT_SECRET', value: stravaSecret });
  if (stravaRedirect) vars.push({ key: 'STRAVA_REDIRECT_URI', value: stravaRedirect });
  return vars.filter((v) => v.value);
}

async function api(apiPath, options = {}) {
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

async function getOwnerId() {
  const ownerId = process.env.RENDER_OWNER_ID ?? env.RENDER_OWNER_ID;
  if (ownerId) return ownerId;
  const owners = await api('/owners?limit=20');
  const list = Array.isArray(owners) ? owners : [];
  const entry = list[0];
  const id = entry?.owner?.id ?? entry?.id;
  if (!id) throw new Error('No Render workspace found');
  return id;
}

async function findService() {
  let cursor;
  do {
    const q = cursor ? `/services?limit=50&cursor=${cursor}` : '/services?limit=50';
    const page = await api(q);
    const list = Array.isArray(page) ? page : [];
    for (const item of list) {
      const svc = item.service ?? item;
      if (svc.name === SERVICE_NAME) return svc;
    }
    cursor = list[list.length - 1]?.cursor;
  } while (cursor);
  return null;
}

async function createService(ownerId) {
  const payload = {
    type: 'web_service',
    name: SERVICE_NAME,
    ownerId,
    repo: REPO,
    branch: 'main',
    rootDir: ROOT_DIR,
    autoDeploy: 'yes',
    envVars: buildEnvVars(),
    serviceDetails: {
      runtime: 'node',
      plan: 'free',
      env: 'node',
      healthCheckPath: '/health',
      envSpecificDetails: {
        buildCommand: BUILD_COMMAND,
        startCommand: START_COMMAND,
      },
    },
  };
  const created = await api('/services', { method: 'POST', body: JSON.stringify(payload) });
  return created.service ?? created;
}

async function updateEnvVars(serviceId) {
  await api(`/services/${serviceId}/env-vars`, {
    method: 'PUT',
    body: JSON.stringify(buildEnvVars()),
  });
}

async function triggerDeploy(serviceId) {
  const res = await fetch(`https://api.render.com/v1/services/${serviceId}/deploys`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ clearCache: 'clear' }),
  });
  if (!res.ok && res.status !== 202) {
    const text = await res.text();
    throw new Error(`${res.status} ${text}`);
  }
  const text = await res.text();
  if (!text) return { id: 'queued', status: res.status };
  try {
    const body = JSON.parse(text);
    return body.deploy ?? body;
  } catch {
    return { id: 'queued', status: res.status };
  }
}

async function waitForHealth(maxAttempts = 40, intervalMs = 15000) {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const res = await fetch(HEALTH_URL);
      if (res.status === 200) {
        const data = await res.json();
        if (data.status === 'ok') return { status: res.status, data };
      }
      console.log(`Health check ${i}/${maxAttempts}: HTTP ${res.status}`);
    } catch (e) {
      console.log(`Health check ${i}/${maxAttempts}: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Health check failed after ${maxAttempts} attempts: ${HEALTH_URL}`);
}

async function verifyIntelligenceRoutes(baseUrl) {
  const testUser = '00000000-0000-0000-0000-000000000001';
  const checks = [
    [`${baseUrl}/api/training/recovery/intelligence?userId=${testUser}`, 'GET'],
    [`${baseUrl}/api/nutrition/intelligence?userId=${testUser}`, 'GET'],
  ];
  const results = [];
  for (const [url, method] of checks) {
    const res = await fetch(url, { method });
    const text = await res.text();
    const ok = res.status !== 404 && !text.includes('Cannot GET');
    results.push({ url, status: res.status, ok });
  }
  const converse = await fetch(`${baseUrl}/api/ai/converse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: testUser, message: 'deploy verify' }),
  });
  const converseText = await converse.text();
  results.push({
    url: '/api/ai/converse',
    status: converse.status,
    ok: converse.status !== 404 && !converseText.includes('Cannot POST'),
  });
  return results;
}

async function main() {
  console.log('=== LiftFlow Render Deploy ===\n');

  let service = await findService();
  if (service) {
    console.log(`Found existing service: ${service.id}`);
    console.log(`Dashboard: ${service.dashboardUrl ?? 'https://dashboard.render.com'}`);
    await updateEnvVars(service.id);
    console.log('Environment variables updated.');
  } else {
    const ownerId = await getOwnerId();
    console.log(`Creating service in workspace ${ownerId}...`);
    service = await createService(ownerId);
    console.log(`Created service: ${service.id}`);
  }

  console.log('Triggering deploy...');
  const deploy = await triggerDeploy(service.id);
  console.log(`Deploy started: ${deploy.id ?? deploy.status ?? 'queued'}`);

  console.log(`\nWaiting for ${HEALTH_URL} ...`);
  const health = await waitForHealth();

  console.log('\n=== DEPLOY SUCCESS ===');
  console.log(`Service URL: https://${service.slug ?? SERVICE_NAME}.onrender.com`);
  console.log(`Health: HTTP ${health.status}`, JSON.stringify(health.data));

  const baseUrl = `https://${service.slug ?? SERVICE_NAME}.onrender.com`;
  console.log('\nVerifying intelligence routes (may take 1–2 min after deploy)...');
  await new Promise((r) => setTimeout(r, 30000));
  const routes = await verifyIntelligenceRoutes(baseUrl);
  for (const r of routes) {
    console.log(`  ${r.ok ? '✓' : '✗'} ${r.url} — HTTP ${r.status}`);
  }
  const allOk = routes.every((r) => r.ok);
  if (!allOk) {
    console.warn('\nWARNING: Intelligence routes return 404 on production.');
    console.warn('Render deploys from GitHub main — commit + push backend changes, then re-run deploy:render');
  }
  if (health.data?.openai === 'missing') {
    console.warn('\nWARNING: OPENAI_API_KEY not set on Render — add to .env and re-run deploy:render');
  }
}

main().catch((e) => {
  console.error('\nDEPLOY FAILED:', e.message);
  process.exit(1);
});
