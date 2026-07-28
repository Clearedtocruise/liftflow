#!/usr/bin/env node
/**
 * Production deployment orchestrator.
 *
 * Required env vars (export before running):
 *   GITHUB_TOKEN or `gh auth login`
 *   RENDER_API_KEY — https://dashboard.render.com/u/settings#api-keys
 *   EXPO_TOKEN1 — liftflow1 access token (https://expo.dev/settings/access-tokens)
 *                 Do NOT use EXPO_TOKEN — that credential is immadoer and cannot build this app.
 *
 * Reads secrets from local .env (not committed):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
 *   EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
 *
 * Usage: node scripts/deploy-production.mjs
 */

import { execSync } from 'child_process';
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

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: root, ...opts });
}

function gh(args) {
  run(`gh ${args}`);
}

const env = loadEnv();
const report = [];

async function renderDeploy(repoUrl) {
  const apiKey = process.env.RENDER_API_KEY;
  if (!apiKey) {
    report.push(['Render', 'SKIP', 'Set RENDER_API_KEY']);
    return;
  }

  const owner = process.env.RENDER_OWNER ?? process.env.GITHUB_OWNER;
  const res = await fetch('https://api.render.com/v1/services', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'web_service',
      name: 'liftflow-api',
      ownerId: owner,
      repo: repoUrl,
      branch: 'main',
      rootDir: 'backend',
      runtime: 'node',
      plan: 'free',
      buildCommand: 'npm install && npm run build',
      startCommand: 'npm start',
      healthCheckPath: '/health',
      envVars: [
        { key: 'NODE_ENV', value: 'production' },
        { key: 'SUPABASE_URL', value: env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL },
        { key: 'SUPABASE_SERVICE_ROLE_KEY', value: env.SUPABASE_SERVICE_ROLE_KEY },
        { key: 'OPENAI_API_KEY', value: env.OPENAI_API_KEY ?? '' },
      ].filter((v) => v.value),
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    report.push(['Render', 'FAIL', `${res.status} ${body.slice(0, 200)}`]);
    return;
  }
  report.push(['Render', 'PASS', 'Service created — first deploy in progress']);
}

async function verifyHealth() {
  const url = 'https://liftflow-api.onrender.com/health';
  for (let i = 0; i < 12; i++) {
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'ok') {
        report.push(['Health', 'PASS', JSON.stringify(data)]);
        return;
      }
    } catch {
      /* retry */
    }
    console.log(`Waiting for Render deploy... (${i + 1}/12)`);
    await new Promise((r) => setTimeout(r, 15000));
  }
  report.push(['Health', 'FAIL', 'https://liftflow-api.onrender.com/health not ready']);
}

async function easBuilds() {
  const token = process.env.EXPO_TOKEN1;
  if (!token) {
    report.push([
      'EAS builds',
      'SKIP',
      'Set EXPO_TOKEN1 (liftflow1) — do not use EXPO_TOKEN (immadoer). Then: npm run build:ios && npm run build:android:apk',
    ]);
    return;
  }
  try {
    const env = { ...process.env, EXPO_TOKEN: token };
    run('npx eas-cli build --platform ios --profile production --non-interactive', env);
    run('npx eas-cli build --platform android --profile production-apk --non-interactive', env);
    report.push(['EAS builds', 'PASS', 'Builds queued on expo.dev']);
  } catch (e) {
    report.push(['EAS builds', 'FAIL', e.message]);
  }
}

async function main() {
  console.log('=== LiftFlow Production Deployment ===\n');

  try {
    run('gh auth status');
  } catch {
    console.error('Run: gh auth login');
    process.exit(1);
  }

  const repoName = process.env.GITHUB_REPO ?? 'liftflow';
  let repoUrl;

  try {
    repoUrl = execSync(`gh repo view ${repoName} --json url -q .url`, { cwd: root, encoding: 'utf8' }).trim();
    console.log(`Repo exists: ${repoUrl}`);
    run('git push -u origin main');
  } catch {
    gh(`repo create ${repoName} --public --source=. --remote=origin --push`);
    repoUrl = execSync('gh repo view --json url -q .url', { cwd: root, encoding: 'utf8' }).trim();
  }

  report.push(['GitHub', 'PASS', repoUrl]);

  console.log('\n--- Render: create service via Dashboard → New Blueprint → render.yaml ---');
  console.log('Or set RENDER_API_KEY + RENDER_OWNER to auto-create via API.\n');
  await renderDeploy(repoUrl);
  await verifyHealth();
  await easBuilds();

  console.log('\n=== DEPLOYMENT REPORT ===\n');
  for (const [name, status, detail] of report) {
    console.log(`${status.padEnd(6)} ${name}\t${detail}`);
  }
}

main();
