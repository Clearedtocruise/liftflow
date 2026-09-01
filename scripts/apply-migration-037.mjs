#!/usr/bin/env node
/**
 * Apply migration 037 — enable RLS on migration-030 backup tables.
 *
 *   SUPABASE_ACCESS_TOKEN=... node scripts/apply-migration-037.mjs
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync(path.join(root, '.env'), 'utf8').split('\n')) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !env[match[1]]) env[match[1]] = match[2].trim();
    }
  } catch {
    // Environment-only is fine.
  }
  return env;
}

const env = loadEnv();
const token = env.SUPABASE_ACCESS_TOKEN;
const projectRef =
  env.SUPABASE_PROJECT_REF ??
  (env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL ?? '').match(
    /https:\/\/([^.]+)\.supabase\.co/,
  )?.[1];

if (!token || !projectRef) {
  console.error('BLOCKER: set SUPABASE_ACCESS_TOKEN and SUPABASE_URL / SUPABASE_PROJECT_REF.');
  process.exit(1);
}

const sql = readFileSync(
  path.join(root, 'supabase/migrations/037_enable_rls_on_backup_tables.sql'),
  'utf8',
);

const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
});

const text = await response.text();
if (!response.ok) {
  console.error(`Apply failed: ${response.status} ${text}`);
  process.exit(1);
}

console.log(`Applied 037_enable_rls_on_backup_tables.sql to ${projectRef}`);

const verify = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `
      select c.relname as table_name, c.relrowsecurity as rls_enabled
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind = 'r'
        and c.relname in (
          '_backup_030_dedupe_workout_exercises',
          '_backup_030_dedupe_workout_sets'
        )
      order by c.relname;
    `,
  }),
});
const rows = await verify.json();
console.log(rows);
if (!Array.isArray(rows) || rows.some((row) => !row.rls_enabled)) {
  console.error('VERIFY FAIL: backup tables still missing RLS');
  process.exit(1);
}
console.log('VERIFY PASS: backup tables have RLS enabled');
