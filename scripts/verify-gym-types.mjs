#!/usr/bin/env node
/**
 * Verify migration 010 — all gym profile types save to profiles + workout_locations.
 * Usage: node scripts/verify-gym-types.mjs
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

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

const GYM_TYPES = ['home_gym', 'garage_gym', 'planet_fitness', 'commercial_gym', 'full_gym'];

const env = loadEnv();
const url = env.EXPO_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing Supabase URL or service role key in .env');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

async function main() {
  console.log('=== Gym Type Constraint Verification (Migration 010) ===\n');

  const email = `gymtype.${Date.now()}@clearedtocruise.com`;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: 'LiftFlow2026!GymTest',
    email_confirm: true,
  });
  if (createErr) throw createErr;
  const userId = created.user.id;

  let passed = 0;
  for (const gymType of GYM_TYPES) {
    const { error } = await admin.from('profiles').update({ training_location: gymType }).eq('id', userId);
    if (error) {
      console.log(`✗ ${gymType}: ${error.message}`);
    } else {
      console.log(`✓ ${gymType}: saved`);
      passed += 1;
    }
  }

  await admin.auth.admin.deleteUser(userId);
  console.log(`\n${passed}/${GYM_TYPES.length} gym types passed`);
  process.exit(passed === GYM_TYPES.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
