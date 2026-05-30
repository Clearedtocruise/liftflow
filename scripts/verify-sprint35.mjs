#!/usr/bin/env node
/**
 * Sprint 3.5 verification: schema status + API endpoints + integration logic.
 * Usage: node scripts/verify-sprint35.mjs [apiBase]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadEnvFile() {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs.readFileSync(envPath, 'utf8').split('\n').filter((l) => l && !l.startsWith('#')).map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
  );
}

const env = loadEnvFile();
const API = process.argv[2] ?? env.EXPO_PUBLIC_API_URL ?? 'https://liftflow-api.onrender.com';

async function loadBackendEnv() {
  await import(path.join(root, 'backend/dist/loadEnv.js'));
}

async function checkSchema() {
  await loadBackendEnv();
  const { createClient } = await import('@supabase/supabase-js');
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const probes = [
    { migration: '003', name: 'profiles.available_equipment', fn: () => db.from('profiles').select('available_equipment').limit(1) },
    { migration: '004', name: 'profiles.primary_gym_name', fn: () => db.from('profiles').select('primary_gym_name').limit(1) },
    { migration: '005', name: 'workout_locations', fn: () => db.from('workout_locations').select('id').limit(1) },
    { migration: '006', name: 'workout_locations.latitude', fn: () => db.from('workout_locations').select('latitude').limit(1) },
    { migration: '007', name: 'recovery_assessments.check_in_date', fn: () => db.from('recovery_assessments').select('check_in_date').limit(1) },
    { migration: '007', name: 'training_limitations', fn: () => db.from('training_limitations').select('id').limit(1) },
  ];

  const rows = [];
  for (const p of probes) {
    const { error } = await p.fn();
    rows.push({ migration: p.migration, object: p.name, status: error ? 'MISSING' : 'APPLIED', detail: error?.message });
  }
  return rows;
}

async function checkEndpoints(userId) {
  const routes = [
    { name: 'Health', method: 'GET', path: '/health' },
    { name: 'Program dashboard', method: 'GET', path: `/api/training/programs/dashboard?userId=${userId}` },
    { name: 'Program planned', method: 'GET', path: `/api/training/programs/planned?userId=${userId}&from=2026-01-01&to=2026-12-31` },
    { name: 'Program generate', method: 'POST', path: '/api/training/programs/generate', body: { userId, programType: 'push_pull_legs', frequency: 4 } },
    { name: 'Recovery check-in', method: 'POST', path: '/api/training/recovery/check-in', body: { userId, sleepHours: 7, sleepQuality: 8, energyLevel: 7, stressLevel: 3, sorenessLevel: 4 } },
    { name: 'Recovery trend', method: 'GET', path: `/api/training/recovery/trend?userId=${userId}` },
    { name: 'Limitations', method: 'GET', path: `/api/training/limitations?userId=${userId}` },
    { name: 'Adaptive nutrition', method: 'POST', path: '/api/nutrition/adaptive-targets', body: { userId } },
    { name: 'Daily meal plan', method: 'POST', path: '/api/nutrition/daily-plan', body: { userId, dietaryStyle: 'high_protein' } },
  ];

  const results = [];
  for (const r of routes) {
    try {
      const res = await fetch(`${API}${r.path}`, {
        method: r.method,
        headers: r.body ? { 'Content-Type': 'application/json' } : {},
        body: r.body ? JSON.stringify(r.body) : undefined,
      });
      const text = await res.text();
      results.push({ name: r.name, path: r.path.split('?')[0], status: res.status, ok: res.status < 400, preview: text.slice(0, 80) });
    } catch (e) {
      results.push({ name: r.name, path: r.path, status: 0, ok: false, preview: e.message });
    }
  }
  return results;
}

async function checkLogic() {
  const { applySubstitutionsToExercises } = await import(path.join(root, 'backend/dist/lib/exerciseSubstitution.js'));
  const { calculateRecoveryScore } = await import(path.join(root, 'backend/dist/lib/recoveryScore.js'));
  const { expandAvailableEquipment, exerciseMeetsEquipment } = await import(path.join(root, 'backend/dist/lib/workoutPlanner.js'));

  const areas = ['shoulder', 'elbow', 'lower back', 'hip', 'knee'];
  const subs = areas.map((area) => {
    const ex = [{ name: 'Barbell Bench Press', sets: 4, reps: '8', restSeconds: 90 }];
    const out = applySubstitutionsToExercises(ex, [{ bodyArea: area, limitationType: 'pain' }]);
    return { area, result: out[0].name !== ex[0].name ? out[0].name : 'NO_SUB' };
  });

  const low = calculateRecoveryScore({ sleepHours: 5, sleepQuality: 4, energyLevel: 3, stressLevel: 8, sorenessLevel: 8 });

  const home = expandAvailableEquipment(['dumbbells', 'bench', 'bodyweight']);
  const gym = expandAvailableEquipment(['full_gym']);
  const barbellEx = { name: 'Bench', equipment: 'barbell', metadata: { requires: ['barbell', 'bench', 'rack'] }, slug: '', category: '', id: '', muscle_groups: [] };

  return {
    limitations: subs,
    recovery: { score: low.recoveryScore, recoveryMode: low.recoveryModeActive, volumeMult: low.volumeMultiplier },
    equipment: { homeBlocksBarbell: !exerciseMeetsEquipment(barbellEx, home), gymAllowsBarbell: exerciseMeetsEquipment(barbellEx, gym) },
  };
}

async function main() {
  console.log('=== Sprint 3.5 Verification ===');
  console.log('API:', API, '\n');

  console.log('## Migration Status');
  const schema = await checkSchema();
  for (const r of schema) console.log(`  [${r.migration}] ${r.object}: ${r.status}${r.detail && r.status === 'MISSING' ? ' — ' + r.detail.slice(0, 60) : ''}`);

  const { createClient } = await import('@supabase/supabase-js');
  await loadBackendEnv();
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: profile } = await db.from('profiles').select('id').limit(1).maybeSingle();
  const userId = profile?.id ?? '00000000-0000-0000-0000-000000000001';

  console.log('\n## Endpoint Verification');
  const endpoints = await checkEndpoints(userId);
  for (const e of endpoints) console.log(`  ${e.ok ? '✓' : '✗'} ${e.name} (${e.path}) HTTP ${e.status}`);

  console.log('\n## Logic Checks (local build)');
  const logic = await checkLogic();
  console.log('  Recovery low score:', logic.recovery);
  console.log('  Equipment filter:', logic.equipment);
  for (const s of logic.limitations) console.log(`  Limitation ${s.area}: ${s.result}`);

  const schemaMissing = schema.filter((r) => r.status === 'MISSING').length;
  const endpointMissing = endpoints.filter((e) => !e.ok).length;
  console.log(`\nSummary: ${schemaMissing} schema gaps, ${endpointMissing} endpoint failures`);
  process.exit(schemaMissing > 0 || endpointMissing > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
