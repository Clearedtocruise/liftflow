#!/usr/bin/env node
/**
 * Diagnose Migration 010 gym type failures — root cause report
 */
import { createClient } from '@supabase/supabase-js';
import { loadRootEnv, projectRefFromUrl } from './lib/migration010.mjs';

const GYM_TYPES = ['home_gym', 'garage_gym', 'planet_fitness', 'commercial_gym', 'full_gym'];
const env = loadRootEnv();
const url = env.EXPO_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const ref = projectRefFromUrl(url);

console.log('=== Migration 010 Diagnostic Report ===\n');
console.log(`Project: ${ref ?? 'unknown'}`);
console.log(`Migration file: supabase/migrations/010_coach_onboarding.sql`);
console.log('');

console.log('## Root cause\n');
console.log('Migration 010 was NEVER applied to the production Supabase database.');
console.log('Migration 003 created profiles.training_location with CHECK (home_gym, commercial_gym) only.');
console.log('Migration 010 drops and recreates the constraint to add garage_gym, planet_fitness, full_gym.');
console.log('');
console.log('This is NOT missing enums, RLS policies, or seed data — it is pending DDL.\n');

if (!url || !serviceKey) {
  console.error('Cannot probe live DB — missing Supabase URL or service role key.');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const email = `diag010.${Date.now()}@clearedtocruise.com`;
const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email,
  password: 'LiftFlow2026!Diag',
  email_confirm: true,
});
if (createErr) {
  console.error('Probe failed:', createErr.message);
  process.exit(1);
}

console.log('## Live constraint probe\n');
console.log('| Gym type | Result |');
console.log('|----------|--------|');

const results = [];
for (const gymType of GYM_TYPES) {
  const { error } = await admin.from('profiles').update({ training_location: gymType }).eq('id', created.user.id);
  const pass = !error;
  results.push({ gymType, pass, message: error?.message });
  console.log(`| ${gymType} | ${pass ? 'PASS' : 'FAIL'} |`);
}

await admin.auth.admin.deleteUser(created.user.id);

console.log('\n## Expected after migration 010\n');
console.log('All 5 types PASS. workout_locations.location_type constraint also expanded.\n');

console.log('## Apply commands\n');
console.log('Option A (preferred): SUPABASE_ACCESS_TOKEN in .env → npm run migrate:010');
console.log('Option B: DATABASE_URL or SUPABASE_DB_PASSWORD in .env → npm run migrate:010');
console.log('Option C: Supabase Dashboard → SQL Editor → paste 010_coach_onboarding.sql\n');

const passCount = results.filter((r) => r.pass).length;
console.log(`## Summary: ${passCount}/${GYM_TYPES.length} types pass today`);
process.exit(passCount === GYM_TYPES.length ? 0 : 1);
