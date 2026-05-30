#!/usr/bin/env node
/**
 * Create a LiftFlow test account and verify core Supabase flows.
 * Usage: node scripts/setup-test-account.mjs
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

const env = loadEnv();
const url = env.EXPO_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL;
const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const TEST_EMAIL = 'liftflow.tester@clearedtocruise.com';
const TEST_PASSWORD = 'LiftFlow2026!Test';
const TEST_NAME = 'LiftFlow Tester';

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

const results = [];

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? `: ${detail}` : ''}`);
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.error(`✗ ${name}${detail ? `: ${detail}` : ''}`);
}

async function ensureUser() {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
  const existing = list?.users?.find((u) => u.email === TEST_EMAIL);
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, { password: TEST_PASSWORD, email_confirm: true });
    pass('Test account exists (password reset)', TEST_EMAIL);
    return existing.id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: TEST_NAME },
  });
  if (error) throw error;
  pass('Test account created', TEST_EMAIL);
  return data.user.id;
}

async function verifySignup() {
  const probeEmail = `liftflow.probe.${Date.now()}@clearedtocruise.com`;
  const { data, error } = await client.auth.signUp({
    email: probeEmail,
    password: TEST_PASSWORD,
    options: { data: { display_name: 'Probe User' } },
  });
  if (error) {
    fail('Signup', error.message);
    return null;
  }
  if (!data.session) {
    fail('Signup', 'No session — disable email confirmation in Supabase Auth');
    return null;
  }
  pass('Signup', probeEmail);
  await admin.auth.admin.deleteUser(data.user.id);
  return data.user.id;
}

async function verifyLogin(userId) {
  const { data, error } = await client.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (error) {
    fail('Login', error.message);
    return null;
  }
  pass('Login', data.user?.email ?? TEST_EMAIL);
  return data.session?.access_token ?? null;
}

async function verifyWorkout(userId, token) {
  const authed = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: session, error: sessionErr } = await authed
    .from('workout_sessions')
    .insert({ user_id: userId, name: 'Expo Go Test Session', status: 'active' })
    .select('*')
    .single();
  if (sessionErr) {
    fail('Workout session create', sessionErr.message);
    return;
  }

  const { data: exercise } = await authed.from('exercises').select('id, name').limit(1).maybeSingle();
  if (!exercise) {
    fail('Workout logging', 'No exercises in database — run seed migration');
    return;
  }

  const { data: we, error: weErr } = await authed
    .from('workout_exercises')
    .insert({ session_id: session.id, exercise_id: exercise.id, sort_order: 0 })
    .select('*')
    .single();
  if (weErr) {
    fail('Workout exercise add', weErr.message);
    return;
  }

  const { error: setErr } = await authed.from('workout_sets').insert({
    workout_exercise_id: we.id,
    set_number: 1,
    weight: 135,
    reps: 10,
    logged_at: new Date().toISOString(),
  });
  if (setErr) {
    fail('Workout set log', setErr.message);
    return;
  }

  pass('Workout logging', `${exercise.name} 135×10`);
  await authed.from('workout_sessions').update({ status: 'completed' }).eq('id', session.id);
}

async function verifyNutrition(userId, token) {
  const authed = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const today = new Date().toISOString().slice(0, 10);
  const { error } = await authed.from('meals').insert({
    user_id: userId,
    meal_type: 'lunch',
    name: 'Expo Go Test Meal',
    scheduled_date: today,
    calories: 650,
    protein_g: 45,
    carbs_g: 60,
    fat_g: 20,
  });
  if (error) {
    fail('Nutrition tracking', error.message);
    return;
  }
  pass('Nutrition tracking', '650 cal lunch logged');
}

async function verifyProgressPhoto(userId, token) {
  const authed = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tinyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  const filePath = `${userId}/expo-go-test-${Date.now()}.png`;

  const { error: uploadErr } = await admin.storage.from('progress-photos').upload(filePath, tinyPng, {
    contentType: 'image/png',
    upsert: true,
  });
  if (uploadErr) {
    fail('Progress photo upload', uploadErr.message);
    return;
  }

  const { data: pub } = admin.storage.from('progress-photos').getPublicUrl(filePath);
  const { error: rowErr } = await authed.from('progress_photos').insert({
    user_id: userId,
    photo_url: pub.publicUrl,
    angle: 'front',
    taken_at: new Date().toISOString(),
  });
  if (rowErr) {
    fail('Progress photo record', rowErr.message);
    return;
  }
  pass('Progress photo upload', filePath);
}

async function main() {
  console.log('=== LiftFlow Test Account & Verification ===\n');
  const userId = await ensureUser();
  await verifySignup();
  const token = await verifyLogin(userId);
  if (token) {
    await verifyWorkout(userId, token);
    await verifyNutrition(userId, token);
    await verifyProgressPhoto(userId, token);
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n--- Credentials ---');
  console.log(`Email:    ${TEST_EMAIL}`);
  console.log(`Password: ${TEST_PASSWORD}`);
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed`);
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
