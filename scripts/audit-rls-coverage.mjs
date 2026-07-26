#!/usr/bin/env node
/**
 * Reports tables where row-level security is enabled but no policy grants access.
 *
 * That combination is not a partially open door, it is a closed one: Postgres denies everything.
 * The service-role key bypasses RLS, so every backend path keeps working and the breakage only shows
 * up in the app — where a denied select returns an empty array rather than an error, and so reads as
 * "this user has no data".
 *
 * Needs the service-role key, because this queries the catalog.
 *   SUPABASE_ACCESS_TOKEN=... node scripts/audit-rls-coverage.mjs
 */
import { readFileSync } from 'node:fs';

/** Tables only the backend touches. Closed to the client is the correct state for these. */
const BACKEND_ONLY = new Set([
  'ad_impressions',
  'beta_invites',
  'beta_invite_redemptions',
  'exercise_recognition_events',
  'outcome_cohort_signals',
  'population_outcome_aggregates',
]);

function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync('.env', 'utf8').split('\n')) {
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
const projectRef = (env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL ?? '').match(
  /https:\/\/([^.]+)\.supabase\.co/,
)?.[1];

if (!token || !projectRef) {
  console.error('BLOCKER: set SUPABASE_ACCESS_TOKEN and SUPABASE_URL.');
  process.exit(1);
}

const query = `
  select c.relname as table_name,
         (select count(*) from pg_policy p where p.polrelid = c.oid) as policies
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  order by c.relname;
`;

const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
});

if (!response.ok) {
  console.error(`Query failed: ${response.status} ${await response.text()}`);
  process.exit(1);
}

const rows = await response.json();
const unreachable = rows.filter((row) => Number(row.policies) === 0);
const clientFacing = unreachable.filter((row) => !BACKEND_ONLY.has(row.table_name));
const intentional = unreachable.filter((row) => BACKEND_ONLY.has(row.table_name));

console.log(`\ntables with RLS enabled: ${rows.length}`);
console.log(`of those, no policy at all: ${unreachable.length}`);
console.log(`  backend-only, correctly closed: ${intentional.length}`);
console.log(`  client-facing, unreachable:      ${clientFacing.length}`);

if (clientFacing.length > 0) {
  console.log('\nThese are read or written by the app and will silently return nothing:\n');
  for (const row of clientFacing) console.log(`  ${row.table_name}`);
  console.log('\nRLS coverage: FAIL');
  process.exit(1);
}

console.log('\nRLS coverage: PASS');
