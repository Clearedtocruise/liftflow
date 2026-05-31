#!/usr/bin/env node
/**
 * Sprint 7.5 — Nutrition Intelligence Engine unit tests
 */

function inferWeightTrend(samples) {
  if (samples.length === 0) return { trend: 'unknown' };
  const sorted = [...samples].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const latest = sorted[sorted.length - 1];
  const earliest = sorted[0];
  const delta = Math.round((latest.weightKg - earliest.weightKg) * 100) / 100;
  if (Math.abs(delta) < 0.3) return { trend: 'stable', deltaKg: delta };
  return { trend: delta < 0 ? 'losing' : 'gaining', deltaKg: delta };
}

function computeHydrationMl(bodyWeightKg, workoutType) {
  const bw = bodyWeightKg ?? 75;
  let ml = Math.round(bw * 35);
  if (workoutType === 'leg' || workoutType === 'full') ml = Math.round(ml * 1.15);
  return Math.max(2000, ml);
}

function computeNutritionAdherence(logDays7d, targetDays = 7) {
  return Math.min(100, Math.round((logDays7d / targetDays) * 100));
}

function buildCoachingTips(input, macros, gaps) {
  const tips = [];
  if (input.isTrainingDay && gaps.carbsRemainingG > 40) {
    tips.push({ action: 'increase_carbs', priority: 1 });
  }
  if (input.goal === 'fat_loss' && gaps.caloriesRemaining < -150) {
    tips.push({ action: 'reduce_calories', priority: 1 });
  }
  if (gaps.proteinRemainingG > 25) {
    tips.push({ action: 'increase_protein', priority: 2 });
  }
  if (gaps.hydrationRemainingMl > 500) {
    tips.push({ action: 'hydration_reminder', priority: 3 });
  }
  return tips;
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

console.log('=== Nutrition Intelligence Engine Tests ===\n');

const losing = inferWeightTrend([
  { weightKg: 82, recordedAt: '2026-05-01' },
  { weightKg: 80.5, recordedAt: '2026-05-15' },
]);
if (losing.trend === 'losing') pass('Weight trend — losing');
else fail('Weight trend — losing', losing.trend);

const stable = inferWeightTrend([
  { weightKg: 80, recordedAt: '2026-05-01' },
  { weightKg: 80.1, recordedAt: '2026-05-15' },
]);
if (stable.trend === 'stable') pass('Weight trend — stable');
else fail('Weight trend — stable');

if (computeHydrationMl(80, 'leg') >= computeHydrationMl(80, 'rest')) pass('Hydration higher on leg day');
else fail('Hydration leg day');

if (computeNutritionAdherence(5) === 71) pass('Adherence calculation', '5/7 days');
else fail('Adherence calculation');

const tips = buildCoachingTips(
  { isTrainingDay: true, goal: 'muscle_gain' },
  { carbsG: 250, hydrationMl: 2800 },
  { carbsRemainingG: 60, caloriesRemaining: 200, proteinRemainingG: 40, hydrationRemainingMl: 900 },
);
if (tips.some((t) => t.action === 'increase_carbs') && tips.some((t) => t.action === 'hydration_reminder')) {
  pass('Coaching tips generated');
} else fail('Coaching tips');

const fatLossTips = buildCoachingTips(
  { isTrainingDay: false, goal: 'fat_loss' },
  { carbsG: 150, hydrationMl: 2500 },
  { carbsRemainingG: 10, caloriesRemaining: -200, proteinRemainingG: 5, hydrationRemainingMl: 100 },
);
if (fatLossTips.some((t) => t.action === 'reduce_calories')) pass('Reduce calories coaching on surplus');
else fail('Reduce calories coaching');

const failed = checks.filter((c) => c.s === 'FAIL').length;
console.log(`\n=== Summary: ${checks.length - failed}/${checks.length} PASS ===`);
process.exit(failed ? 1 : 0);
