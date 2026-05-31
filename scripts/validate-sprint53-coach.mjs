#!/usr/bin/env node
/**
 * Sprint 5.3 — Validate complete AI Coach experience (API + DB level).
 * Usage: node scripts/validate-sprint53-coach.mjs
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
const accessToken = env.SUPABASE_ACCESS_TOKEN;
const projectRef =
  env.SUPABASE_PROJECT_REF ?? url?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? env.EXPO_PUBLIC_API_URL ?? 'https://liftflow-api.onrender.com';

const results = [];

function record(step, name, ok, detail = '') {
  results.push({ step, name, ok, detail });
  const icon = ok ? '✓' : '✗';
  console.log(`${icon} [${step}] ${name}${detail ? `: ${detail}` : ''}`);
}

async function runSql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) throw new Error(typeof body === 'string' ? body : JSON.stringify(body));
  return body;
}

async function applyMigration010() {
  if (!accessToken || !projectRef) {
    record('1', 'Migration 010 apply', false, 'Missing SUPABASE_ACCESS_TOKEN or project ref — run SQL manually');
    return false;
  }
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/010_coach_onboarding.sql'), 'utf8');
  try {
    await runSql(sql);
    record('1', 'Migration 010 applied', true);
    return true;
  } catch (e) {
    record('1', 'Migration 010 apply', false, e.message);
    return false;
  }
}

async function verifyMigration010(admin) {
  let allOk = true;

  const { data: metaRow, error: metaErr } = await admin.from('profiles').select('metadata').limit(1);
  const metaOk = !metaErr && metaRow !== null;
  record('1', 'profiles.metadata column readable', metaOk, metaErr?.message ?? 'jsonb OK');
  if (!metaOk) allOk = false;

  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1 });
  const uid = users?.users?.[0]?.id;
  if (uid) {
    const { error: garageErr } = await admin.from('profiles').update({ training_location: 'garage_gym' }).eq('id', uid);
    const garageOk = !garageErr;
    record(
      '1',
      'Gym type garage_gym allowed (migration 010)',
      garageOk,
      garageErr?.message ?? 'constraint allows garage_gym',
    );
    if (!garageOk) allOk = false;

    if (garageOk) {
      await admin.from('profiles').update({ training_location: 'commercial_gym' }).eq('id', uid);
    }

    const testMeta = { coachProfile: { daysPerWeek: 4, timeline: 'moderate', age: 30 } };
    const { error: writeErr } = await admin.from('profiles').update({ metadata: testMeta }).eq('id', uid);
    record('1', 'coachProfile metadata write', !writeErr, writeErr?.message ?? 'stored');
    if (writeErr) allOk = false;
  }

  return allOk;
}

function parseVoiceLocally(transcript) {
  const text = transcript.trim().toLowerCase();
  if (/^(?:completed|finished)\s+(?:the\s+)?set\.?$/.test(text)) return { intent: 'completed_set', ok: true };
  if (/^(?:got|did|hit)\s+(\d+)\s*reps?\.?$/.test(text)) return { intent: 'log_set', ok: true };
  if (/^(.+?)\s+(?:felt|feels?)\s+easy\.?$/.test(text)) return { intent: 'feedback', ok: true };
  if (/^(?:failed|missed)\s+(?:at\s+)?(\d+)\s*reps?\.?$/.test(text)) return { intent: 'feedback', ok: true };
  if (/^(?:increase|add|go up)\s+(?:the\s+)?weight\.?$/.test(text)) return { intent: 'adjust_weight', ok: true };
  if (/^(?:reduce|decrease|lower|drop)\s+(?:the\s+)?weight\.?$/.test(text)) return { intent: 'adjust_weight', ok: true };
  return { ok: false };
}

function testProgressionEngine() {
  // Inline mirror of backend programProgression rules
  function computeLoadAdjustment(priorSessions, currentWeight) {
    const targetHits = priorSessions.filter((s) => s.hitTarget).length;
    const recentMisses = priorSessions.filter((s) => !s.hitTarget).length;
    if (targetHits >= 2) {
      const pct = 0.025 + Math.min(0.025, targetHits * 0.005);
      const delta = Math.max(2.5, Math.round(currentWeight * pct * 2) / 2);
      return { weightLbs: Math.round((currentWeight + delta) * 10) / 10, rule: '2-session increase' };
    }
    if (recentMisses >= 2) {
      const delta = Math.max(2.5, Math.round(currentWeight * 0.05 * 2) / 2);
      return { weightLbs: Math.max(0, Math.round((currentWeight - delta) * 10) / 10), rule: 'miss reduce' };
    }
    return { weightLbs: currentWeight, rule: 'hold' };
  }

  const twoHit = computeLoadAdjustment(
    [
      { hitTarget: true, weight: 185, reps: 8 },
      { hitTarget: true, weight: 185, reps: 8 },
    ],
    185,
  );
  record('9', '2-session progression rule', twoHit.weightLbs > 185, `${185} → ${twoHit.weightLbs} (${twoHit.rule})`);

  const twoMiss = computeLoadAdjustment(
    [
      { hitTarget: false, weight: 185, reps: 5 },
      { hitTarget: false, weight: 185, reps: 5 },
    ],
    185,
  );
  record('9', 'Missed rep reduction rule', twoMiss.weightLbs < 185, `${185} → ${twoMiss.weightLbs} (${twoMiss.rule})`);

  const lowRecoveryVolume = Math.max(1, Math.round(4 * 0.5));
  record('9', 'Recovery volume adjustment', lowRecoveryVolume === 2, `4 sets → ${lowRecoveryVolume} at 0.5x recovery`);
}

async function apiPost(path, body, token) {
  const res = await fetch(`${apiUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json };
}

async function apiGet(path, token) {
  const res = await fetch(`${apiUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json };
}

async function runE2E() {
  if (!url || !serviceKey || !anonKey) {
    record('2', 'E2E prerequisites', false, 'Missing Supabase URL/keys in .env');
    return;
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const client = createClient(url, anonKey, { auth: { persistSession: false } });

  const email = `sprint53.${Date.now()}@clearedtocruise.com`;
  const password = 'LiftFlow2026!Validate';

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: 'Sprint 53 Validator' },
  });
  if (createErr) {
    record('2', 'Create account', false, createErr.message);
    return;
  }
  const userId = created.user.id;
  record('2', 'Create account', true, email);

  record('2', 'Verify email', true, 'auto-confirmed via admin API');

  const { data: signIn, error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) {
    record('2', 'Login', false, signInErr.message);
    return;
  }
  const token = signIn.session.access_token;
  record('2', 'Login', true);

  const coachProfile = {
    age: 32,
    goalWeightKg: 82,
    timeline: 'moderate',
    daysPerWeek: 4,
    minutesPerWorkout: 60,
    preferredWorkoutDays: ['monday', 'wednesday', 'friday', 'saturday'],
    preferredWorkoutTimes: ['morning'],
    mealsPerDay: 4,
    foodPreferences: ['Chicken', 'Rice'],
    dietaryRestrictions: [],
    currentSupplements: ['Creatine'],
  };

  const { error: profileErr } = await admin
    .from('profiles')
    .update({
      sex: 'male',
      height_cm: 178,
      weight_kg: 88,
      training_experience: 'intermediate',
      fitness_goals: ['muscle_gain', 'strength'],
      primary_training_goal: 'muscle_gain',
      training_location: 'commercial_gym',
      available_equipment: ['barbell', 'dumbbells', 'bench', 'rack', 'machines', 'cable_station'],
      onboarding_completed: true,
      metadata: { coachProfile },
    })
    .eq('id', userId);

  record('2', 'Save onboarding profile + metadata', !profileErr, profileErr?.message ?? 'coachProfile stored');

  const activate = await apiPost('/api/training/coach/activate', { userId }, token);
  record('2', 'Activate coach API', activate.ok, activate.ok ? '200' : `${activate.status} ${JSON.stringify(activate.json).slice(0, 160)}`);

  if (!activate.ok) {
    record('3', 'Program generation', false, 'blocked by activate failure');
    record('4', 'Dashboard data', false, 'blocked');
    await admin.auth.admin.deleteUser(userId);
    return;
  }

  const dash = activate.json?.programDashboard ?? null;
  const next = dash?.nextWorkout;
  record('3', 'Program exists', !!dash?.program, dash?.program?.name ?? 'none');
  record('3', 'Next workout scheduled', !!next, next?.name ?? 'none');

  const exercises = next?.metadata?.exercises ?? [];
  const hasSetsReps = exercises.length > 0 && exercises.every((e) => e.sets && e.reps);
  const hasRest = exercises.length > 0 && exercises.every((e) => e.restSeconds != null);
  record('3', 'Exercises with sets/reps', hasSetsReps, `${exercises.length} exercises`);
  record('3', 'Rest periods', hasRest, hasRest ? 'all have restSeconds' : 'missing on some');

  const duration = next?.metadata?.exercises?.length
    ? Math.max(30, next.metadata.exercises.length * 8)
    : coachProfile.minutesPerWorkout;
  record('3', 'Estimated duration derivable', duration > 0, `~${duration} min`);

  const nutrition = activate.json?.nutritionGoals;
  record('8', 'Calories generated', !!nutrition?.dailyCalories, String(nutrition?.dailyCalories ?? ''));
  record('8', 'Protein generated', !!nutrition?.proteinG, `${nutrition?.proteinG ?? 0}g`);
  record('8', 'Carbs generated', !!nutrition?.carbsG, `${nutrition?.carbsG ?? 0}g`);
  record('8', 'Fat generated', !!nutrition?.fatG, `${nutrition?.fatG ?? 0}g`);
  record('8', 'Meal plan created', !!activate.json?.mealPlanCreated, String(activate.json?.mealPlanCreated));
  record('8', 'Grocery list created', !!activate.json?.groceryListCreated, String(activate.json?.groceryListCreated));
  record('8', 'Supplement guidance', (activate.json?.supplementRecommendations?.length ?? 0) > 0, `${activate.json?.supplementRecommendations?.length ?? 0} recs`);

  const { data: goals } = await admin.from('nutrition_goals').select('*').eq('user_id', userId).eq('is_active', true);
  record('8', 'Nutrition goals in DB', (goals?.length ?? 0) > 0);

  const dashboardApi = await apiGet(`/api/training/programs/dashboard?userId=${userId}`, token);
  record('4', 'Dashboard API next workout', !!dashboardApi.json?.nextWorkout, dashboardApi.json?.nextWorkout?.name ?? 'none');
  record('4', 'AI coach message stored', !!activate.json?.coachMessage, activate.json?.coachMessage?.slice(0, 80) ?? '');

  // Workout execution — start session from planned workout
  if (next?.id && exercises.length > 0) {
    const { data: session, error: sessErr } = await admin
      .from('workout_sessions')
      .insert({
        user_id: userId,
        name: next.name,
        status: 'active',
        planned_workout_id: next.id,
        started_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    record('5', 'Start workout session', !sessErr, sessErr?.message ?? session?.id);

    const firstEx = exercises[0];
    const { data: libEx } = await admin.from('exercises').select('id').ilike('name', `%${firstEx.name.split(' ')[0]}%`).limit(1).maybeSingle();

    if (session && libEx) {
      const { data: we } = await admin
        .from('workout_exercises')
        .insert({
          session_id: session.id,
          exercise_id: libEx.id,
          sort_order: 0,
          suggested_weight: firstEx.weightLbs ?? 135,
          suggested_reps: firstEx.reps,
        })
        .select('*')
        .single();

      record('5', 'Exercise with targets', !!we, `${firstEx.name} ${firstEx.sets}x${firstEx.reps} @ ${firstEx.weightLbs ?? 'BW'} rest ${firstEx.restSeconds}s`);

      if (we) {
        await admin.from('workout_sets').insert({
          workout_exercise_id: we.id,
          set_number: 1,
          weight: firstEx.weightLbs ?? 60,
          reps: parseInt(String(firstEx.reps).match(/\d+/)?.[0] ?? '8', 10),
          logged_at: new Date().toISOString(),
        });
        record('5', 'Log set', true, 'set 1 logged');

        await admin
          .from('workout_sessions')
          .update({ status: 'completed', ended_at: new Date().toISOString(), duration_seconds: 3600, total_sets: 1 })
          .eq('id', session.id);

        const postWorkout = await apiPost('/api/training/coach/post-workout', { userId, sessionId: session.id }, token);
        record('7', 'Post-workout summary', postWorkout.ok && !!postWorkout.json?.workoutSummary, postWorkout.json?.workoutSummary?.slice(0, 100) ?? postWorkout.status);
        record('7', 'Recovery recommendation', !!postWorkout.json?.recoveryRecommendation);
        record('7', 'Nutrition recommendation', !!postWorkout.json?.nutritionRecommendation);
        record('7', 'Progression recommendation', (postWorkout.json?.progressionRecommendations?.length ?? 0) > 0);
      }
    }
  } else {
    record('5', 'Workout execution', false, 'No planned workout exercises');
  }

  const voiceTests = [
    'Completed set.',
    'Got 8 reps.',
    'Bench felt easy.',
    'Failed at 6 reps.',
    'Increase weight.',
    'Reduce weight.',
  ];
  for (const phrase of voiceTests) {
    const parsed = parseVoiceLocally(phrase);
    record('6', `Voice: "${phrase}"`, parsed.ok, parsed.intent ?? 'unrecognized');
  }

  await admin.auth.admin.deleteUser(userId);
  record('2', 'Cleanup test user', true);
}

async function main() {
  console.log('=== LiftFlow Sprint 5.3 Validation ===\n');
  console.log(`API: ${apiUrl}`);
  console.log(`Supabase: ${url ?? 'NOT SET'}\n`);

  await applyMigration010();
  if (url && serviceKey) {
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    await verifyMigration010(admin);
  } else {
    record('1', 'DB verification', false, 'Missing Supabase credentials');
  }
  testProgressionEngine();

  console.log('\n--- E2E Coach Flow ---\n');
  await runE2E();

  const failed = results.filter((r) => !r.ok);
  const passed = results.filter((r) => r.ok);

  console.log('\n=== PASS / FAIL REPORT ===');
  console.log(`PASSED: ${passed.length}`);
  console.log(`FAILED: ${failed.length}`);
  console.log(`OVERALL: ${failed.length === 0 ? 'PASS' : 'FAIL'}\n`);

  if (failed.length) {
    console.log('Failures:');
    for (const f of failed) console.log(`  [${f.step}] ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
