#!/usr/bin/env node
/**
 * Apply Supabase migration 026 — exercise metadata correction.
 * Usage: node scripts/apply-migration-026.mjs [--dry-run]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { buildDatabaseUrl, loadRootEnv, projectRefFromUrl, runSqlViaManagementApi, runSqlViaPostgres } from './lib/migration010.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');
const MIGRATION = '026_fix_exercise_metadata_from_names.sql';

function splitStatements(sql) {
  return sql
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('--'));
}

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

async function runSql(query, env, accessToken, projectRef, dbUrl) {
  if (accessToken && projectRef) {
    await runSqlViaManagementApi(query, accessToken, projectRef);
    return;
  }
  if (dbUrl) {
    await runSqlViaPostgres(query, dbUrl);
    return;
  }
  throw new Error('No database credentials available');
}

async function main() {
  console.log('=== LiftFlow Migration 026 — Exercise Metadata ===\n');
  const env = loadRootEnv();
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN ?? env.SUPABASE_ACCESS_TOKEN;
  const projectRef = env.SUPABASE_PROJECT_REF ?? projectRefFromUrl(env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL);
  const dbUrl = env.SUPABASE_DB_URL ?? env.DATABASE_URL ?? buildDatabaseUrl(env);

  const sqlPath = path.join(root, 'supabase/migrations', MIGRATION);
  if (!fs.existsSync(sqlPath)) {
    console.error(`Missing ${sqlPath} — run: npm run generate:migration-026`);
    process.exit(1);
  }

  if (!dryRun && !((accessToken && projectRef) || dbUrl)) {
    console.error('BLOCKER: Set SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF (or DATABASE_URL) in .env');
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  const statements = splitStatements(sql);
  const batches = chunk(statements, 20);

  console.log(`Project: ${projectRef ?? '(postgres url)'}`);
  console.log(`Statements: ${statements.length} in ${batches.length} batches`);
  console.log(`Mode: ${dryRun ? 'dry-run' : accessToken && projectRef ? 'management-api' : 'postgres'}\n`);

  for (let i = 0; i < batches.length; i++) {
    if (dryRun) {
      console.log(`  [dry-run] batch ${i + 1}/${batches.length}`);
      continue;
    }
    await runSql(batches[i].join('\n'), env, accessToken, projectRef, dbUrl);
    if ((i + 1) % 10 === 0 || i + 1 === batches.length) {
      console.log(`  batch ${i + 1}/${batches.length} applied`);
    }
  }

  if (!dryRun) {
    const verifySql = `select count(*)::int as corrected from public.exercises where is_system = true and metadata->>'education_version' = '1'`;
    if (accessToken && projectRef) {
      const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: verifySql }),
      });
      const rows = JSON.parse(await res.text());
      console.log('\nVerified corrected rows:', rows);
    }
  }

  console.log('\nMigration 026 complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
