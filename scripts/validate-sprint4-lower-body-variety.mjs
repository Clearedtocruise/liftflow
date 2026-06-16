#!/usr/bin/env node
/**
 * Sprint 4 — lower body movement pattern variety (planner anti-duplication)
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

console.log('=== Sprint 4 Lower Body Variety ===\n');

const exclusion = read('backend/src/lib/movementPatternExclusion.ts');
const planner = read('backend/src/lib/workoutPlanner.ts');

record('Pattern exclusion groups file', exclusion.includes('MOVEMENT_PATTERN_EXCLUSION_GROUPS'));
record('Squat family grouped', exclusion.includes("'squat'") && exclusion.includes("'front-squat'"));
record('Deadlift family grouped', exclusion.includes("'deadlift'") && exclusion.includes("'romanian-deadlift'"));
record('Lunge family grouped', exclusion.includes("'walking-lunge'") && exclusion.includes("'bulgarian-split-squat'"));
record('Planner imports pattern exclusion', planner.includes('patternExclusionGroupId'));
record('Planner tracks used pattern groups', planner.includes('usedPatternGroups'));
record('Lower day muscle targets', planner.includes("'quads', 'hamstrings', 'glutes', 'calves', 'core', 'unilateral'"));
record('Unilateral muscle mapping', planner.includes("unilateral: ['lunge_pattern']"));

const failed = checks.filter((c) => !c.pass);
console.log(`\n${failed.length === 0 ? 'All checks passed.' : `${failed.length} check(s) failed.`}`);
process.exit(failed.length === 0 ? 0 : 1);
