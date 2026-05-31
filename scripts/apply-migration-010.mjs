#!/usr/bin/env node
/**
 * Apply migration 010 — Management API or direct postgres (DATABASE_URL)
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { applyMigration010, loadRootEnv } from './lib/migration010.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

async function main() {
  console.log('=== Apply Migration 010 — Gym Types ===\n');
  const env = loadRootEnv();
  const method = await applyMigration010(env);
  console.log(`✓ Applied via ${method}\n`);

  const verify = spawnSync('node', ['scripts/verify-gym-types.mjs'], { cwd: root, encoding: 'utf8' });
  process.stdout.write(verify.stdout ?? '');
  if (verify.stderr) process.stderr.write(verify.stderr);
  process.exit(verify.status ?? 1);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  console.error('\nSet SUPABASE_ACCESS_TOKEN or DATABASE_URL / SUPABASE_DB_PASSWORD in .env');
  console.error('Manual: Supabase Dashboard → SQL Editor → supabase/migrations/010_coach_onboarding.sql');
  process.exit(1);
});
