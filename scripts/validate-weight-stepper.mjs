#!/usr/bin/env node
/**
 * Weight stepper — exact display-unit increments (+5 lb / +2.5 kg)
 */
const LB_PER_KG = 2.2046226218;

function displayWeightFromKg(kg, unit) {
  if (unit === 'kg') {
    const v = Math.round(kg * 10) / 10;
    return v % 1 === 0 ? Math.round(v) : v;
  }
  return Math.round(kg * LB_PER_KG);
}

function adjustWeightKg(currentKg, unit, deltaSteps) {
  const display = displayWeightFromKg(currentKg, unit);
  const step = unit === 'kg' ? 2.5 : 5;
  const nextDisplay = Math.max(0, display + deltaSteps * step);
  const snapped = Math.round(nextDisplay / step) * step;
  return unit === 'kg' ? snapped : snapped / LB_PER_KG;
}

const checks = [];
function record(name, pass, detail = '') {
  checks.push({ name, pass, detail });
  console.log(`  ${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`);
}

console.log('=== Weight Stepper ===\n');

const start100LbKg = 100 / LB_PER_KG;
let kg = start100LbKg;
const lbSteps = [];
for (let i = 0; i < 3; i++) {
  kg = adjustWeightKg(kg, 'lb', 1);
  lbSteps.push(displayWeightFromKg(kg, 'lb'));
}
record('+5 lb x3 from 100 lb', lbSteps.join(' → ') === '105 → 110 → 115', lbSteps.join(' → '));

kg = start100LbKg;
const lbDown = [];
for (let i = 0; i < 2; i++) {
  kg = adjustWeightKg(kg, 'lb', -1);
  lbDown.push(displayWeightFromKg(kg, 'lb'));
}
record('-5 lb x2 from 100 lb', lbDown.join(' → ') === '95 → 90', lbDown.join(' → '));

kg = 60;
const kgSteps = [];
for (let i = 0; i < 3; i++) {
  kg = adjustWeightKg(kg, 'kg', 1);
  kgSteps.push(displayWeightFromKg(kg, 'kg'));
}
record('+2.5 kg x3 from 60 kg', kgSteps.join(' → ') === '62.5 → 65 → 67.5', kgSteps.join(' → '));

const failed = checks.filter((c) => !c.pass);
console.log(`\n${failed.length === 0 ? 'All checks passed.' : `${failed.length} check(s) failed.`}`);
process.exit(failed.length === 0 ? 0 : 1);
