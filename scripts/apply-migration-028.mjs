#!/usr/bin/env node
/**
 * Apply Supabase migration 028 — dedupe duplicate exercise catalog rows.
 * Usage: node scripts/apply-migration-028.mjs [--dry-run]
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
const MIGRATION = '028_dedupe_duplicate_exercise_names.sql';

function stripSqlComments(sql) {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
}

function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let inString = false;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const prev = sql[i - 1];

    if (char === "'" && prev !== '\\') {
      inString = !inString;
    }

    if (char === ';' && !inString) {
      const trimmed = current.trim();
      if (trimmed && !trimmed.startsWith('--')) {
        statements.push(trimmed);
      }
      current = '';
      continue;
    }

    current += char;
  }

  const tail = current.trim();
  if (tail && !tail.startsWith('--')) statements.push(tail);
  return statements;
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
  console.log('=== LiftFlow Migration 028 — Dedupe Exercise Catalog ===\n');
  const env = loadRootEnv();
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN ?? env.SUPABASE_ACCESS_TOKEN;
  const projectRef = env.SUPABASE_PROJECT_REF ?? projectRefFromUrl(env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL);
  const dbUrl = env.SUPABASE_DB_URL ?? env.DATABASE_URL ?? buildDatabaseUrl(env);

  const sqlPath = path.join(root, 'supabase/migrations', MIGRATION);
  if (!fs.existsSync(sqlPath)) {
    console.error(`Missing ${sqlPath} — run: node scripts/generate-dedupe-exercise-migration.mjs`);
    process.exit(1);
  }

  if (!dryRun && !((accessToken && projectRef) || dbUrl)) {
    console.error('BLOCKER: Set SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF in .env');
    process.exit(1);
  }

  const sql = stripSqlComments(fs.readFileSync(sqlPath, 'utf8'));
  const statements = splitSqlStatements(sql);

  console.log(`Project: ${projectRef ?? '(postgres url)'}`);
  console.log(`Statements: ${statements.length}`);
  console.log(`Mode: ${dryRun ? 'dry-run' : accessToken && projectRef ? 'management-api' : 'postgres'}\n`);

  for (let i = 0; i < statements.length; i++) {
    if (dryRun) {
      console.log(`  [dry-run] ${i + 1}/${statements.length}: ${statements[i].slice(0, 60)}...`);
      continue;
    }
    await runSql(statements[i], env, accessToken, projectRef, dbUrl);
    if ((i + 1) % 5 === 0 || i + 1 === statements.length) {
      console.log(`  applied ${i + 1}/${statements.length}`);
    }
  }

  if (!dryRun && accessToken && projectRef) {
    const verifySql = `
      select
        count(*) filter (where is_system)::int as system_count,
        count(*) filter (
          where is_system
            and slug ~ '-(ch|ba|la|sh|tr|qd|hm|gl|cv|co|fa|nc|ca|fu|bi)[0-9]{2,4}$'
        )::int as variant_count
      from public.exercises;
    `;
    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: verifySql }),
    });
    const rows = JSON.parse(await res.text());
    console.log('\nPost-migration counts:', rows);
  }

  console.log('\nMigration 028 complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
