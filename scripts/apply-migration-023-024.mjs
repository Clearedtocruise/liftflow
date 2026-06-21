#!/usr/bin/env node
/**
 * Apply Supabase migrations 023 (core catalog) and 024 (1000 exercise import).
 *
 * Usage: node scripts/apply-migration-023-024.mjs [--dry-run]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { buildDatabaseUrl, loadRootEnv, projectRefFromUrl, runSqlViaManagementApi, runSqlViaPostgres } from './lib/migration010.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');

const MIGRATIONS = [
  '020_exercise_classification.sql',
  '023_expand_core_exercise_catalog.sql',
  '024_import_1000_exercise_catalog.sql',
];

async function ensurePrerequisites(env, accessToken, projectRef, dbUrl) {
  if (dryRun) return MIGRATIONS;
  const checkSql = `select column_name from information_schema.columns where table_schema='public' and table_name='exercises' and column_name='exercise_type' limit 1`;
  let hasType = false;
  if (accessToken && projectRef) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: checkSql }),
    });
    const rows = JSON.parse(await res.text());
    hasType = Array.isArray(rows) && rows.length > 0;
  }
  if (!hasType && dbUrl) {
    const pg = await import('pg');
    const client = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();
    try {
      const { rows } = await client.query(checkSql);
      hasType = rows.length > 0;
    } finally {
      await client.end();
    }
  }
  if (hasType) {
    console.log('Prerequisite: exercises.exercise_type already present — skipping 020');
    return MIGRATIONS.filter((f) => f !== '020_exercise_classification.sql');
  }
  console.log('Prerequisite: applying 020_exercise_classification.sql (exercise_type column)');
  return MIGRATIONS;
}

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
    return 'management';
  }
  if (dbUrl) {
    await runSqlViaPostgres(query, dbUrl);
    return 'postgres';
  }
  throw new Error('No database credentials available');
}

async function applyMigrationFile(file, env, accessToken, projectRef, dbUrl) {
  const sqlPath = path.join(root, 'supabase/migrations', file);
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const statements = splitStatements(sql);

  if (file.startsWith('024_')) {
    const batches = chunk(statements, 25);
    console.log(`  ${statements.length} statements in ${batches.length} batches`);
    for (let i = 0; i < batches.length; i++) {
      const batchSql = batches[i].join('\n');
      if (dryRun) {
        console.log(`  [dry-run] batch ${i + 1}/${batches.length}`);
        continue;
      }
      await runSql(batchSql, env, accessToken, projectRef, dbUrl);
      if ((i + 1) % 10 === 0 || i + 1 === batches.length) {
        console.log(`  batch ${i + 1}/${batches.length} applied`);
      }
    }
    return;
  }

  if (dryRun) {
    console.log(`  [dry-run] ${statements.length} statement(s)`);
    return;
  }
  await runSql(sql, env, accessToken, projectRef, dbUrl);
}

async function verify(env, accessToken, projectRef, dbUrl) {
  const checks = [
    {
      label: 'core crunch catalog',
      sql: `select slug from public.exercises where slug = 'crunch' and is_system = true limit 1`,
    },
    {
      label: 'imported catalog rows',
      sql: `select count(*)::int as count from public.exercises where is_system = true and metadata ? 'source_exercise_id'`,
    },
    {
      label: 'system exercise total',
      sql: `select count(*)::int as count from public.exercises where is_system = true`,
    },
  ];

  const results = [];
  for (const check of checks) {
    if (dryRun) {
      results.push({ ...check, status: 'SKIPPED' });
      continue;
    }
    try {
      if (accessToken && projectRef) {
        const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: check.sql }),
        });
        const text = await res.text();
        if (!res.ok) throw new Error(text);
        const rows = JSON.parse(text);
        results.push({ ...check, status: 'OK', rows });
      } else {
        const pg = await import('pg');
        const client = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
        await client.connect();
        try {
          const { rows } = await client.query(check.sql);
          results.push({ ...check, status: 'OK', rows });
        } finally {
          await client.end();
        }
      }
    } catch (e) {
      results.push({ ...check, status: 'ERROR', detail: e.message });
    }
  }
  return results;
}

async function main() {
  console.log('=== LiftFlow Migrations 023 + 024 ===\n');
  const env = loadRootEnv();
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN ?? env.SUPABASE_ACCESS_TOKEN;
  const projectRef = env.SUPABASE_PROJECT_REF ?? projectRefFromUrl(env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL);
  const dbUrl = env.SUPABASE_DB_URL ?? env.DATABASE_URL ?? buildDatabaseUrl(env);

  if (!dryRun && !((accessToken && projectRef) || dbUrl)) {
    console.error('BLOCKER: Set SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF (or DATABASE_URL) in .env');
    console.error('\nManual apply — Supabase Dashboard → SQL Editor:');
    for (const file of MIGRATIONS) console.error(`  supabase/migrations/${file}`);
    process.exit(1);
  }

  console.log(`Project: ${projectRef ?? '(postgres url)'}`);
  console.log(`Mode: ${dryRun ? 'dry-run' : accessToken && projectRef ? 'management-api' : 'postgres'}\n`);

  const toApply = await ensurePrerequisites(env, accessToken, projectRef, dbUrl);

  for (const file of toApply) {
    console.log(`Applying ${file}...`);
    await applyMigrationFile(file, env, accessToken, projectRef, dbUrl);
    console.log(`  ✓ ${file}`);
  }

  console.log('\nVerification:');
  const report = await verify(env, accessToken, projectRef, dbUrl);
  for (const r of report) {
    if (r.status === 'OK') {
      console.log(`  ✓ ${r.label}:`, JSON.stringify(r.rows));
    } else {
      console.log(`  ${r.status === 'SKIPPED' ? '–' : '✗'} ${r.label}${r.detail ? ` — ${r.detail}` : ''}`);
    }
  }

  const imported = report.find((r) => r.label === 'imported catalog rows');
  const importedCount = imported?.rows?.[0]?.count ?? imported?.rows?.[0]?.count;
  if (!dryRun && imported?.status === 'OK') {
    const count = Number(imported.rows?.[0]?.count ?? 0);
    if (count < 900) {
      console.error(`\nWARNING: expected ~1000 imported rows, found ${count}`);
      process.exit(1);
    }
  }

  console.log('\nMigrations 023 + 024 complete.');
  console.log('Next: deploy backend, rebuild app, Settings → Workouts per week → Save.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
