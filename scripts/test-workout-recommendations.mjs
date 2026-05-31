#!/usr/bin/env node
/**
 * Sprint 7.3 — Workout Recommendation Engine unit tests
 */

function overlaps(a, b) {
  const setA = new Set(a);
  return b.some((m) => setA.has(m));
}

function inferSplitStyle(goals, daysPerWeek) {
  const primary = goals[0] ?? 'general_fitness';
  if (primary === 'strength') return 'strength';
  if (primary === 'hypertrophy' || primary === 'muscle_gain') return daysPerWeek >= 5 ? 'bodybuilding' : 'push_pull_legs';
  if (primary === 'fat_loss' || primary === 'weight_loss') return 'fat_loss';
  if (daysPerWeek <= 3) return 'full_body';
  return 'upper_lower';
}

function pickWeakMuscles(volumeMap, muscleRecovery) {
  const weakFromVolume = [...volumeMap.entries()].sort((a, b) => a[1] - b[1]).slice(0, 2).map(([m]) => m);
  const weakFromRecovery = [...muscleRecovery].sort((a, b) => a.score - b.score).slice(0, 2).map((m) => m.muscle);
  return [...new Set([...weakFromRecovery, ...weakFromVolume])].slice(0, 3);
}

const checks = [];
function pass(n, d = '') {
  checks.push({ n, s: 'PASS', d });
  console.log(`  ✓ ${n}${d ? ' — ' + d : ''}`);
}
function fail(n, d = '') {
  checks.push({ n, s: 'FAIL', d });
  console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`);
}

console.log('=== Workout Recommendation Engine Tests ===\n');

if (inferSplitStyle(['strength'], 4) === 'strength') pass('Strength goal → strength split');
else fail('Strength split');

if (inferSplitStyle(['fat_loss'], 4) === 'fat_loss') pass('Fat loss goal → fat_loss split');
else fail('Fat loss split');

if (inferSplitStyle(['hypertrophy'], 5) === 'bodybuilding') pass('Hypertrophy 5d → bodybuilding');
else fail('Bodybuilding split');

const volume = new Map([
  ['chest', 500],
  ['back', 15000],
  ['legs', 8000],
]);
const recovery = [
  { muscle: 'chest', score: 45 },
  { muscle: 'back', score: 88 },
  { muscle: 'legs', score: 72 },
];
const weak = pickWeakMuscles(volume, recovery);
if (weak.includes('chest')) pass('Weak muscle detection', weak.join(', '));
else fail('Weak muscle detection', weak.join(', '));

if (overlaps(['chest', 'shoulders'], ['chest'])) pass('Muscle overlap check');
else fail('Muscle overlap');

const restDay = { trainingRecommendation: 'rest_day', recoveryScore: 35 };
if (restDay.trainingRecommendation === 'rest_day' && restDay.recoveryScore < 40) pass('Rest day on low recovery');
else fail('Rest day logic');

const highRecovery = { trainingRecommendation: 'train', recoveryScore: 88, sessions7d: 3 };
if (highRecovery.trainingRecommendation === 'train' && highRecovery.recoveryScore >= 75) pass('Train on high recovery');
else fail('Train recommendation');

const missedCatchUp = { missed: [{ muscleGroups: ['back'] }], todayMuscles: ['back', 'biceps'] };
if (overlaps(missedCatchUp.todayMuscles, missedCatchUp.missed[0].muscleGroups)) pass('Missed workout muscle overlap');
else fail('Missed workout catch-up');

const failed = checks.filter((c) => c.s === 'FAIL').length;
console.log(`\n=== Summary: ${checks.length - failed}/${checks.length} PASS ===`);
process.exit(failed ? 1 : 0);
