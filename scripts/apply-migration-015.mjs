#!/usr/bin/env node
/**
 * Apply migration 015 — Sprint 8.5 Beta User Readiness Pack
 * Usage: node scripts/apply-migration-015.mjs [--dry-run]
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
const SQL_PATH = path.join(root, 'supabase/migrations/015_sprint85_beta_readiness.sql');

async function verifyMigration(accessToken, projectRef) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `select table_name from information_schema.tables where table_schema='public' and table_name in ('beta_feedback','app_events','beta_invites')`,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text);
  const rows = JSON.parse(text);
  const names = new Set((rows ?? []).map((r) => r.table_name));
  return {
    beta_feedback: names.has('beta_feedback'),
    app_events: names.has('app_events'),
    beta_invites: names.has('beta_invites'),
  };
}

async function main() {
  console.log('=== Apply Migration 015 — Beta Readiness ===\n');
  const env = loadRootEnv();
  const accessToken = env.SUPABASE_ACCESS_TOKEN;
  const projectRef =
    env.SUPABASE_PROJECT_REF ?? projectRefFromUrl(env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL);

  if (accessToken && projectRef) {
    console.log('Pre-apply:');
    const before = await verifyMigration(accessToken, projectRef);
    console.log(`  beta_feedback: ${before.beta_feedback ? 'EXISTS' : 'MISSING'}`);
    console.log(`  app_events: ${before.app_events ? 'EXISTS' : 'MISSING'}`);
    console.log(`  beta_invites: ${before.beta_invites ? 'EXISTS' : 'MISSING'}`);

    if (before.beta_feedback && before.app_events && before.beta_invites) {
      console.log('\nMigration 015 already applied.');
      process.exit(0);
    }
  }

  const sql = fs.readFileSync(SQL_PATH, 'utf8');

  if (dryRun) {
    console.log('--dry-run: would apply 015_sprint85_beta_readiness.sql');
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
      console.error('Manual: Supabase Dashboard → SQL Editor → supabase/migrations/015_sprint85_beta_readiness.sql');
      process.exit(1);
    }
    await runSqlViaPostgres(sql, dbUrl);
    method = 'postgres';
  }

  console.log(`\n✓ Applied via ${method}`);

  if (accessToken && projectRef) {
    const after = await verifyMigration(accessToken, projectRef);
    console.log('\nPost-apply:');
    console.log(`  beta_feedback: ${after.beta_feedback ? 'OK' : 'MISSING'}`);
    console.log(`  app_events: ${after.app_events ? 'OK' : 'MISSING'}`);
    console.log(`  beta_invites: ${after.beta_invites ? 'OK' : 'MISSING'}`);
    if (!after.beta_feedback || !after.app_events || !after.beta_invites) process.exit(1);
  }

  console.log('\nMigration 015 verified.');
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
