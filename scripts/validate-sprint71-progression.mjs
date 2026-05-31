#!/usr/bin/env node
/**
 * Sprint 7.1 — Smart Progression Engine validation
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const checks = [];
function pass(n, d = '') {
  checks.push(1);
  console.log(`  ✓ ${n}${d ? ' — ' + d : ''}`);
}
function fail(n, d = '') {
  checks.push(0);
  console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

console.log('=== Sprint 7.1 Smart Progression Validation ===\n');

for (const f of [
  'src/types/progression.ts',
  'src/lib/smartProgressionEngine.ts',
  'src/services/progressionService.ts',
  'src/components/workout/SmartProgressionCard.tsx',
  'backend/src/lib/smartProgressionEngine.ts',
  'backend/src/lib/loadSmartProgression.ts',
]) {
  if (fs.existsSync(path.join(root, f))) pass('File', f);
  else fail('Missing', f);
}

const client = read('src/lib/smartProgressionEngine.ts');
if (client.includes('computeSmartProgression') && client.includes('progressive_overload')) pass('Client engine');
else fail('Client engine');

const backend = read('backend/src/routes/training.ts');
if (backend.includes('/progression/smart') && backend.includes('loadSmartProgression')) pass('API route');
else fail('API route');

const service = read('src/services/progressionService.ts');
if (service.includes('getSmartProgression') && service.includes('computeSmartProgression')) pass('Progression service');
else fail('Progression service');

const ui = read('src/app/(tabs)/workout.tsx');
if (ui.includes('SmartProgressionCard')) pass('Workout UI');
else fail('Workout UI');

const api = read('src/api/client.ts');
if (api.includes('postSmartProgression')) pass('API client');
else fail('API client');

console.log('\n--- Engine unit smoke ---');
const unit = spawnSync('node', ['scripts/test-smart-progression.mjs'], { cwd: root, encoding: 'utf8' });
if (unit.status === 0) pass('Progressive overload case');
else fail('Progressive overload case', unit.stderr?.slice(0, 80));

const failed = checks.filter((c) => !c).length;
console.log(`\n=== Sprint 7.1 Summary: ${checks.length - failed}/${checks.length} PASS ===`);
process.exit(failed ? 1 : 0);
