#!/usr/bin/env node
/**
 * Reports duplicate workout_exercises rows and the data damage that comes with them.
 *
 * A session should hold each exercise once. When it holds one twice, logging splits across the two
 * rows, the set target is never reached on either, and the exercise never completes. This is the
 * query to run to find out whether that is happening, before and after migration 030.
 *
 * Needs a service-role key, because every table below is behind RLS:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/audit-duplicate-session-exercises.mjs
 */
import { readFileSync } from 'node:fs';

function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync('.env', 'utf8').split('\n')) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !env[match[1]]) env[match[1]] = match[2].trim();
    }
  } catch {
    // No .env is fine when the values come from the environment.
  }
  return env;
}

const env = loadEnv();
const url = env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('BLOCKER: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  console.error('An anon/publishable key cannot see these tables — RLS scopes them to the owning user,');
  console.error('so it returns an empty result rather than an error, which reads as "no duplicates".');
  process.exit(1);
}

async function select(path) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!response.ok) throw new Error(`${path} → ${response.status} ${await response.text()}`);
  return response.json();
}

const [exercises, sets, catalog] = await Promise.all([
  select('workout_exercises?select=id,session_id,exercise_id,sort_order,created_at,exercises(name)&limit=10000'),
  select('workout_sets?select=id,workout_exercise_id,set_number&limit=20000'),
  select('exercises?select=id,name,slug,is_system&limit=5000'),
]);

const setsByExercise = new Map();
for (const set of sets) {
  const list = setsByExercise.get(set.workout_exercise_id) ?? [];
  list.push(set);
  setsByExercise.set(set.workout_exercise_id, list);
}

const groups = new Map();
for (const row of exercises) {
  if (!row.exercise_id) continue;
  const key = `${row.session_id}::${row.exercise_id}`;
  const group = groups.get(key) ?? [];
  group.push(row);
  groups.set(key, group);
}

const duplicates = [...groups.values()].filter((group) => group.length > 1);

console.log(`\nworkout_exercises rows: ${exercises.length}`);
console.log(`sessions: ${new Set(exercises.map((row) => row.session_id)).size}`);
console.log(`duplicate (session, exercise) groups: ${duplicates.length}`);

if (duplicates.length > 0) {
  console.log('\nDuplicates — "split" means logged sets are spread across the copies, so deleting');
  console.log('either one would destroy work. Those need the merge in migration 030, not a delete.\n');
  for (const group of duplicates.sort((a, b) => a[0].session_id.localeCompare(b[0].session_id))) {
    const counts = group.map((row) => setsByExercise.get(row.id)?.length ?? 0);
    const withSets = counts.filter((count) => count > 0).length;
    const shape = withSets > 1 ? 'SPLIT' : withSets === 1 ? 'one copy holds the sets' : 'both empty';
    console.log(
      `  ${group[0].session_id.slice(0, 8)}  ${(group[0].exercises?.name ?? '?').padEnd(26)}` +
        ` ${group.length} copies, sets ${counts.join('+')}  (${shape})`,
    );
  }
}

const collisions = [];
for (const [exerciseId, list] of setsByExercise) {
  const seen = new Map();
  for (const set of list) seen.set(set.set_number, (seen.get(set.set_number) ?? 0) + 1);
  for (const [number, count] of seen) {
    if (count > 1) collisions.push({ exerciseId, number, count });
  }
}
console.log(`\nsets sharing a set_number on one exercise: ${collisions.length}`);
for (const collision of collisions) {
  console.log(`  ${collision.exerciseId.slice(0, 8)}  set ${collision.number} × ${collision.count}`);
}

const gaps = new Map();
for (const row of exercises) {
  const list = gaps.get(row.session_id) ?? [];
  list.push(row.sort_order);
  gaps.set(row.session_id, list);
}
const gappy = [...gaps.entries()].filter(([, orders]) => Math.max(...orders) !== orders.length - 1);
console.log(`\nsessions whose sort_order is not a dense 0..n-1 sequence: ${gappy.length}`);
for (const [sessionId, orders] of gappy) {
  console.log(`  ${sessionId.slice(0, 8)}  [${[...orders].sort((a, b) => a - b).join(', ')}]`);
}

const byName = new Map();
for (const row of catalog) {
  const key = row.name.trim().toLowerCase();
  const list = byName.get(key) ?? [];
  list.push(row);
  byName.set(key, list);
}
const catalogDuplicates = [...byName.entries()].filter(([, list]) => list.length > 1);
console.log(`\ncatalog names held by more than one exercise row: ${catalogDuplicates.length}`);
for (const [name, list] of catalogDuplicates) {
  console.log(`  ${name} → ${list.map((row) => `${row.slug}${row.is_system ? ' (system)' : ' (custom)'}`).join(', ')}`);
}

const clean =
  duplicates.length === 0 &&
  collisions.length === 0 &&
  gappy.length === 0 &&
  catalogDuplicates.length === 0;
console.log(`\n${clean ? 'CLEAN' : 'NEEDS CLEANUP — apply supabase/migrations/030_dedupe_session_workout_exercises.sql'}`);
process.exit(clean ? 0 : 1);
