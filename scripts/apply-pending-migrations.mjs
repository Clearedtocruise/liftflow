#!/usr/bin/env node
/**
 * Apply Supabase migrations 003–007 to the linked production project.
 * Requires SUPABASE_ACCESS_TOKEN in .env (https://supabase.com/dashboard/account/tokens)
 *
 * Usage: node scripts/apply-pending-migrations.mjs [--dry-run]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');

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

const MIGRATIONS = [
  '003_training_profile.sql',
  '004_primary_gym_name.sql',
  '005_workout_locations.sql',
  '006_location_coordinates.sql',
  '007_sprint2_coach_foundation.sql',
  '008_fitness_goals_priority.sql',
  '009_unit_preferences.sql',
  '010_coach_onboarding.sql',
  '011_outcome_intelligence.sql',
];

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
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(typeof body === 'string' ? body : JSON.stringify(body));
  }
  return body;
}

async function verifySchema() {
  const checks = [
    { migration: '003', sql: `select column_name from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='available_equipment'` },
    { migration: '004', sql: `select column_name from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='primary_gym_name'` },
    { migration: '005', sql: `select table_name from information_schema.tables where table_schema='public' and table_name='workout_locations'` },
    { migration: '006', sql: `select column_name from information_schema.columns where table_schema='public' and table_name='workout_locations' and column_name='latitude'` },
    { migration: '007', sql: `select column_name from information_schema.columns where table_schema='public' and table_name='recovery_assessments' and column_name='check_in_date'` },
    { migration: '007', sql: `select table_name from information_schema.tables where table_schema='public' and table_name='training_limitations'` },
  ];

  const report = [];
  for (const c of checks) {
    try {
      const rows = await runSql(c.sql);
      const ok = Array.isArray(rows) && rows.length > 0;
      report.push({ migration: c.migration, status: ok ? 'APPLIED' : 'MISSING' });
    } catch (e) {
      report.push({ migration: c.migration, status: 'ERROR', detail: e.message });
    }
  }
  return report;
}

async function main() {
  console.log('=== LiftFlow Migration Apply ===\n');

  if (!accessToken || !projectRef) {
    console.error('BLOCKER: Set SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF (or SUPABASE_URL) in .env');
    console.error('\nManual apply — run each file in Supabase Dashboard → SQL Editor:');
    for (const file of MIGRATIONS) {
      console.error(`  supabase/migrations/${file}`);
    }
    process.exit(1);
  }

  console.log(`Project: ${projectRef}`);
  console.log('Pre-apply status:');
  const before = await verifySchema();
  for (const r of before) console.log(`  ${r.migration}: ${r.status}${r.detail ? ' — ' + r.detail : ''}`);

  if (dryRun) {
    console.log('\n--dry-run: skipping apply');
    process.exit(0);
  }

  for (const file of MIGRATIONS) {
    const sqlPath = path.join(root, 'supabase/migrations', file);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log(`\nApplying ${file}...`);
    try {
      await runSql(sql);
      console.log(`  ✓ ${file}`);
    } catch (e) {
      console.error(`  ✗ ${file}: ${e.message}`);
    }
  }

  console.log('\nPost-apply status:');
  const after = await verifySchema();
  for (const r of after) console.log(`  ${r.migration}: ${r.status}${r.detail ? ' — ' + r.detail : ''}`);

  const missing = after.filter((r) => r.status !== 'APPLIED');
  if (missing.length) {
    console.error('\nSome objects still missing.');
    process.exit(1);
  }
  console.log('\nAll migrations verified.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
