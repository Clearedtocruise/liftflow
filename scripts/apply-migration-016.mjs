#!/usr/bin/env node
/**
 * Apply migration 016 — Beta tester + founder access flags
 * Usage: node scripts/apply-migration-016.mjs [--dry-run]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
    buildDatabaseUrl,
    loadRootEnv,
    projectRefFromUrl,
    runSqlViaManagementApi,
    runSqlViaPostgres,
} from './lib/migration010.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');
const SQL_PATH = path.join(root, 'supabase/migrations/016_beta_tester_access.sql');

async function verifyMigration(accessToken, projectRef) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `select column_name from information_schema.columns where table_schema='public' and table_name='profiles' and column_name in ('is_beta_tester','is_founder')`,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text);
  const rows = JSON.parse(text);
  const names = new Set((rows ?? []).map((r) => r.column_name));
  return {
    is_beta_tester: names.has('is_beta_tester'),
    is_founder: names.has('is_founder'),
  };
}

async function main() {
  console.log('=== Apply Migration 016 — Beta Tester Access ===\n');
  const env = loadRootEnv();
  const accessToken = env.SUPABASE_ACCESS_TOKEN;
  const projectRef =
    env.SUPABASE_PROJECT_REF ?? projectRefFromUrl(env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL);

  if (accessToken && projectRef) {
    console.log('Pre-apply:');
    const before = await verifyMigration(accessToken, projectRef);
    console.log(`  is_beta_tester: ${before.is_beta_tester ? 'EXISTS' : 'MISSING'}`);
    console.log(`  is_founder: ${before.is_founder ? 'EXISTS' : 'MISSING'}`);

    if (before.is_beta_tester && before.is_founder) {
      console.log('\nMigration 016 already applied.');
      process.exit(0);
    }
  }

  const sql = fs.readFileSync(SQL_PATH, 'utf8');

  if (dryRun) {
    console.log('--dry-run: would apply 016_beta_tester_access.sql');
    process.exit(0);
  }

  let method;
  if (accessToken && projectRef) {
    await runSqlViaManagementApi(sql, accessToken, projectRef);
    method = 'management-api';
  } else {
    const dbUrl = buildDatabaseUrl(env);
    if (!dbUrl) {
      console.error('BLOCKER: Set SUPABASE_ACCESS_TOKEN or DATABASE_URL in .env');
      process.exit(1);
    }
    await runSqlViaPostgres(sql, dbUrl);
    method = 'postgres';
  }

  console.log(`\n✓ Applied via ${method}`);

  if (accessToken && projectRef) {
    const after = await verifyMigration(accessToken, projectRef);
    console.log('\nPost-apply:');
    console.log(`  is_beta_tester: ${after.is_beta_tester ? 'OK' : 'MISSING'}`);
    console.log(`  is_founder: ${after.is_founder ? 'OK' : 'MISSING'}`);
    if (!after.is_beta_tester || !after.is_founder) process.exit(1);
  }

  console.log('\nMigration 016 verified.');
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
