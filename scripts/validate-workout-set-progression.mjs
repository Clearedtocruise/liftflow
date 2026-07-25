#!/usr/bin/env node
/**
 * Workout set progression — traditional mode must not advance after 1 set.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const checks = [];
function record(name, pass, detail = '') {
  checks.push({ name, pass, detail });
  console.log(`  ${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

console.log('=== Workout Set Progression ===\n');

for (const file of [
  'src/lib/supersetFlow.ts',
  'src/lib/workoutProgressionDebug.ts',
  'src/components/workout/execution/ActiveWorkoutScreen.tsx',
]) {
  record(`File exists: ${file}`, fs.existsSync(path.join(root, file)));
}

const flow = read('src/lib/supersetFlow.ts');
const active = read('src/components/workout/execution/ActiveWorkoutScreen.tsx');
const debug = read('src/lib/workoutProgressionDebug.ts');

record(
  'Superset rotation gated by execution mode',
  flow.includes('executionModeUsesSupersetRotation') &&
    flow.includes("mode === 'superset'") &&
    flow.includes("mode === 'circuit'") &&
    flow.includes('executionModeUsesSupersetRotation(executionMode)'),
);
record(
  'Traditional mode skips post-set superset advance',
  flow.includes('immediateAdvanceIndex: null, afterRestAdvanceIndex: null'),
);
record(
  'Active workout uses allSetsDone outside superset/circuit',
  active.includes('executionModeUsesSupersetRotation') &&
    active.includes('usesSupersetRotation && inSuperset') &&
    active.includes(': allSetsDone'),
);
record(
  'Progression debug logging wired',
  debug.includes('logWorkoutProgressionDecision') &&
    active.includes('logWorkoutProgressionDecision') &&
    debug.includes('Advance:'),
);
record(
  'Completion uses completedSets >= effectiveTargetSets',
  active.includes('completedAfterLog >= effectiveTargetSets') &&
    active.includes('allSetsDone = completedSets.length >= effectiveTargetSets'),
);

console.log('\nRule: completedSets >= programmedSets before exercise advance (traditional)');

const pass = checks.filter((c) => c.pass).length;
const total = checks.length;
console.log(`\nSummary: ${pass}/${total} checks`);

if (pass !== total) process.exit(1);
