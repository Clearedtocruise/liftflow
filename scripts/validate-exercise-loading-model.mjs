#!/usr/bin/env node
/**
 * Exercise type vs loading method — acceptance checks
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

console.log('=== Exercise Loading Model ===\n');

const loadingTypes = read('src/types/exerciseLoading.ts');
const loadingLib = read('src/lib/exerciseLoadingMethod.ts');
const catalog = read('src/constants/exerciseDatabase.ts');
const active = read('src/components/workout/execution/ActiveWorkoutScreen.tsx');

record('LoadingMethod type exists', loadingTypes.includes('bodyweight_plus_weight'));
record('Resolver maps to logging modes', loadingLib.includes('loadingMethodToLoggingMode'));
record('Pull-up dual loading', catalog.includes("'pull-up'") && catalog.includes('bodyweight_plus_weight'));
record('Chin-up dual loading', catalog.includes("'chin-up'") && catalog.includes('bodyweight_plus_weight'));
record('Dip dual loading', catalog.includes("'dip'") && catalog.includes('bodyweight_plus_weight'));
record('Walking lunge weighted options', catalog.includes("'walking-lunge'") && catalog.includes('external_load'));
record('Plank timed hold only', catalog.includes("'plank'") && catalog.includes('timed_hold'));
record('History inference helper', loadingLib.includes('inferLoadingMethodFromHistory'));
record('Active workout loading picker', active.includes('loadingMethodRow') && active.includes('setLoadingMethod'));
record('Coach receives derived logging mode', active.includes('loadingMethodToLoggingMode'));

const failed = checks.filter((c) => !c.pass);
console.log(`\n${failed.length === 0 ? 'All checks passed.' : `${failed.length} check(s) failed.`}`);
process.exit(failed.length === 0 ? 0 : 1);
