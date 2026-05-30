#!/usr/bin/env node
/**
 * Static + API integration verification for LiftFlow coaching ecosystem.
 * Usage: node scripts/verify-integration.mjs [userId] [apiBase]
 */

const API = process.argv[3] ?? process.env.EXPO_PUBLIC_API_URL ?? 'https://liftflow-api.onrender.com';
const userId = process.argv[2] ?? '00000000-0000-0000-0000-000000000001';

const failures = [];
const warnings = [];
const passes = [];

async function api(name, path, init) {
  try {
    const res = await fetch(`${API}${path}`, init);
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text.slice(0, 200);
    }
    if (res.ok) {
      passes.push({ name, status: res.status, preview: JSON.stringify(body).slice(0, 120) });
      return { ok: true, body, status: res.status };
    }
    failures.push({ name, status: res.status, body: typeof body === 'string' ? body : JSON.stringify(body).slice(0, 200) });
    return { ok: false, body, status: res.status };
  } catch (e) {
    failures.push({ name, error: e.message });
    return { ok: false, error: e.message };
  }
}

function codeCheck(name, fn) {
  try {
    fn();
    passes.push({ name: `[code] ${name}` });
  } catch (e) {
    failures.push({ name: `[code] ${name}`, error: e.message });
  }
}

async function main() {
  console.log('LiftFlow Integration Verification');
  console.log('API:', API);
  console.log('UserId:', userId);
  console.log('---\n');

  // API probes
  await api('Health', '/health');
  await api('Program dashboard (Sprint 3)', `/api/training/programs/dashboard?userId=${userId}`);
  await api('Recovery check-in (Sprint 2)', '/api/training/recovery/check-in', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, sleepHours: 7, sleepQuality: 8, energyLevel: 7, stressLevel: 3, sorenessLevel: 4 }),
  });
  await api('Program generate (Sprint 3)', '/api/training/programs/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, programType: 'push_pull_legs', frequency: 4, goal: 'muscle_gain', experience: 'intermediate' }),
  });
  await api('Program adapt (Sprint 3)', '/api/training/programs/adapt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  await api('Adaptive nutrition (Sprint 2)', '/api/nutrition/adaptive-targets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  await api('Daily meal plan (Sprint 2)', '/api/nutrition/daily-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, dietaryStyle: 'high_protein' }),
  });
  await api('AI coach', '/api/ai/coach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, message: 'What weight should I use?', context: 'general' }),
  });
  await api('Limitations list', `/api/training/limitations?userId=${userId}`);

  // Static integration checks (grep-like via fs)
  const fs = await import('fs');
  const read = (p) => fs.readFileSync(p, 'utf8');

  codeCheck('endSession marks planned_workout completed', () => {
    const ws = read('src/services/workoutService.ts');
    if (!ws.includes('planned_workouts') || !ws.match(/endSession[\s\S]*planned_workout/)) {
      throw new Error('endSession does not update planned_workouts.status to completed');
    }
  });

  codeCheck('Workout screen passes plannedWorkoutId', () => {
    const w = read('src/app/(tabs)/workout.tsx');
    if (!w.includes('plannedWorkoutId')) {
      throw new Error('workout.tsx never passes plannedWorkoutId when starting session');
    }
  });

  codeCheck('Program create uses location equipment', () => {
    const p = read('src/app/(features)/program-create.tsx');
    if (p.includes('user.availableEquipment') && !p.includes('location?.availableEquipment')) {
      warnings.push({ name: 'program-create uses profile equipment, not per-location equipment' });
    }
  });

  codeCheck('workoutPlanner uses profile equipment only', () => {
    const wp = read('backend/src/lib/workoutPlanner.ts');
    if (!wp.includes('loadUserTrainingProfile') || !wp.includes('available_equipment')) {
      throw new Error('workoutPlanner missing profile equipment load');
    }
    if (!wp.includes('workout_locations')) {
      warnings.push({ name: 'workoutPlanner ignores workout_locations.available_equipment' });
    }
  });

  codeCheck('Substitution engine exists', () => {
    const s = read('backend/src/lib/exerciseSubstitution.ts');
    if (!s.includes('Barbell Bench Press')) throw new Error('missing bench substitution rules');
  });

  codeCheck('Adapt program queries missed workouts', () => {
    const a = read('backend/src/lib/adaptiveProgram.ts');
    if (!a.includes("lt('scheduled_date'") || !a.includes('reschedulePlannedWorkout')) {
      throw new Error('adaptActiveProgram missing missed workout reschedule');
    }
  });

  console.log('PASSES:', passes.length);
  for (const p of passes) console.log('  ✓', p.name, p.status ? `HTTP ${p.status}` : '', p.preview ?? '');

  if (warnings.length) {
    console.log('\nWARNINGS:', warnings.length);
    for (const w of warnings) console.log('  ⚠', w.name);
  }

  if (failures.length) {
    console.log('\nFAILURES:', failures.length);
    for (const f of failures) console.log('  ✗', f.name, f.status ?? '', f.error ?? f.body ?? '');
    process.exit(1);
  }

  console.log('\nAll automated checks passed.');
}

main();
