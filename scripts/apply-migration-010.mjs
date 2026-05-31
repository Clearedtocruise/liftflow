#!/usr/bin/env node
/**
 * Apply migration 010 (gym type constraints) via Supabase Management API.
 * Usage: node scripts/apply-migration-010.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

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

function projectRefFromUrl(url) {
  if (!url) return null;
  const m = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  return m?.[1] ?? null;
}

const env = loadEnv();
const accessToken = process.env.SUPABASE_ACCESS_TOKEN ?? env.SUPABASE_ACCESS_TOKEN;
const projectRef =
  process.env.SUPABASE_PROJECT_REF ??
  env.SUPABASE_PROJECT_REF ??
  projectRefFromUrl(env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL);

async function runSql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text);
  return text ? JSON.parse(text) : null;
}

async function main() {
  console.log('=== Apply Migration 010 — Gym Types ===\n');

  if (!accessToken || !projectRef) {
    console.error('Missing SUPABASE_ACCESS_TOKEN or project ref.');
    console.error('Manual: Supabase Dashboard → SQL Editor → run supabase/migrations/010_coach_onboarding.sql');
    process.exit(1);
  }

  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/010_coach_onboarding.sql'), 'utf8');
  console.log(`Applying to project ${projectRef}...`);
  await runSql(sql);
  console.log('✓ Migration 010 applied\n');

  const verify = spawnSync('node', ['scripts/verify-gym-types.mjs'], { cwd: root, encoding: 'utf8' });
  process.stdout.write(verify.stdout ?? '');
  process.exit(verify.status ?? 1);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
