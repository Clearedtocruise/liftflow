#!/usr/bin/env node
/**
 * Sprint 10 — Production Polish validation
 * Validates deliverables exist and documents known P0 gaps for tracking.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const checks = [];
function record(name, pass, detail = '', required = true) {
  checks.push({ name, pass, detail, required });
  const tag = required ? '' : ' (tracking)';
  console.log(`  ${pass ? 'PASS' : 'FAIL'} — ${name}${tag}${detail ? ' — ' + detail : ''}`);
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

console.log('=== Sprint 10 Production Polish ===\n');

console.log('--- Deliverables ---');
for (const file of [
  'docs/SPRINT10_FINAL_AUDIT.md',
  'docs/SPRINT10_PRODUCTION_CHECKLIST.md',
  'docs/SPRINT10_LAUNCH_RECOMMENDATION.md',
]) {
  record(`File exists: ${file}`, exists(file));
}

const audit = read('docs/SPRINT10_FINAL_AUDIT.md');
const checklist = read('docs/SPRINT10_PRODUCTION_CHECKLIST.md');
const launch = read('docs/SPRINT10_LAUNCH_RECOMMENDATION.md');

for (const token of [
  'Workout UX',
  'Nutrition UX',
  'Recovery UX',
  'Readiness UX',
  'AI Coaching',
  'Loading states',
  'Empty states',
  'Typography',
  'Visual hierarchy',
  '66/100',
]) {
  record(`Audit covers: ${token}`, audit.includes(token));
}

record('Checklist: Batch A dead ends', checklist.includes('Batch A'));
record('Checklist: Batch B coach', checklist.includes('Batch B'));
record('Checklist: Batch C recovery', checklist.includes('Batch C'));
record('Checklist: acceptance criteria', checklist.includes('No obvious UX friction'));
record('Launch: conditional recommendation', launch.includes('CONDITIONAL GO') || launch.includes('NOT YET'));
record('Launch: beta before public', launch.includes('Sprint 9') || launch.includes('beta'));

console.log('\n--- Batch A–C P0 fixes ---');
const dayTsx = read('src/app/(tabs)/workout/day.tsx');
const coachingTsx = read('src/app/(tabs)/coaching.tsx');
const dashboardTsx = read('src/app/(tabs)/dashboard.tsx');
const coachCard = read('src/components/workout/ExerciseCoachCard.tsx');

record(
  'W-P0-1 day.tsx error/empty states',
  dayTsx.includes('ErrorStateCard') && !dayTsx.includes('loading || !workout'),
);
record(
  'C-P0-1 coaching Pro retry on null intel',
  coachingTsx.includes('isPremium ?') && coachingTsx.includes('fallbackCard'),
);
record(
  'R-P0-2 recovery ring dynamic color',
  dashboardTsx.includes('recoveryScoreColor') && !dashboardTsx.includes('color={LiftFlowColors.success}'),
);
record(
  'W-P0-4 coach failure fallback',
  coachCard.includes('if (!prescription)') && !coachCard.includes('if (!prescription) return null'),
);
record('StateCard shared empty/error component', exists('src/components/layout/StateCard.tsx'));
record('recoveryScoreColor helper', exists('src/lib/recoveryScoreColor.ts'));

console.log('\n--- Batch D–F polish ---');
const nutritionTsx = read('src/app/(tabs)/nutrition/index.tsx');
const workoutCard = read('src/components/workout/WorkoutCard.tsx');
const weeklyPlan = read('src/components/workout/execution/WorkoutWeeklyPlanScreen.tsx');
const settingsTsx = read('src/app/(tabs)/settings.tsx');

record('N-P0-1 nutrition load error state', nutritionTsx.includes('loadError') && nutritionTsx.includes('ErrorStateCard'));
record('N-P1-3 nutrition intelligence card', nutritionTsx.includes('Nutrition Intelligence') && nutritionTsx.includes('intelCard'));
record('N-P1-6 nutrition preferences link', nutritionTsx.includes('nutrition-preferences'));
record('N-P0-2 meal detail sheet', exists('src/components/nutrition/MealDetailSheet.tsx') && nutritionTsx.includes('MealDetailSheet'));
record('W-P0-6 WorkoutCard actual reps', workoutCard.includes('suggestedReps') && !workoutCard.includes('× 4–6'));
record('W-P1-5 quick log label', weeklyPlan.includes('Quick log') && !weeklyPlan.includes('Manual Log (fallback)'));
record('C-P0-2 coaching hub settings label', settingsTsx.includes('AI Coaching Hub'));
record('Coaching shortcut groups', coachingTsx.includes('linkGroup'));
record('Meal offline suggestions badge', read('src/components/nutrition/MealReplaceSheet.tsx').includes('Offline suggestions'));

console.log('\n--- Regression ---');
const backendBuild = spawnSync('npm', ['run', 'build'], { cwd: path.join(root, 'backend'), encoding: 'utf8', shell: true });
record('Backend TypeScript build', backendBuild.status === 0);

const required = checks.filter((c) => c.required !== false);
const requiredPass = required.filter((c) => c.pass).length;
const pass = checks.filter((c) => c.pass).length;
console.log(`\nSummary: ${pass}/${checks.length} checks (${requiredPass}/${required.length} required)`);

if (requiredPass !== required.length) process.exit(1);
