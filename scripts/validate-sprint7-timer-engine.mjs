#!/usr/bin/env node
/**
 * Sprint 7 — Timer engine validation (distinct from equipment adaptation sprint 7)
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

console.log('=== Sprint 7 Timer Engine ===\n');

for (const file of [
  'src/lib/timerEngine.ts',
  'src/hooks/useWorkoutTimerEngine.ts',
  'src/components/workout/execution/WorkoutTimerOverlay.tsx',
  'src/components/cardio/IntervalTimerPanel.tsx',
]) {
  record(`File exists: ${file}`, fs.existsSync(path.join(root, file)));
}

const engine = read('src/lib/timerEngine.ts');
const hook = read('src/hooks/useWorkoutTimerEngine.ts');
const overlay = read('src/components/workout/execution/WorkoutTimerOverlay.tsx');
const active = read('src/components/workout/execution/ActiveWorkoutScreen.tsx');
const modes = read('src/constants/workoutExecutionModes.ts');
const cardio = read('src/constants/cardioActivities.ts');

record('Traditional default 90s', engine.includes('DEFAULT_REST_SECONDS') || modes.includes('restSeconds: 90'));
record('Tabata defaults 20/20/10', modes.includes('workSeconds: 20') && modes.includes('restSeconds: 20') && modes.includes('rounds: 10'));
record('Interval skip round', engine.includes('skipIntervalRound') && overlay.includes('Skip round'));
record('Interval phase cues', fs.existsSync(path.join(root, 'src/lib/intervalTimerFeedback.ts')));
record('Tabata auto-start in active workout', active.includes('startIntervalTimer(undefined, executionMode === \'tabata\')'));
record('Interval tick machine', engine.includes('tickIntervalTimer'));
record('Circuit transition timer', engine.includes('tickCircuitTimer') && engine.includes('circuit_transition'));
record('Unified timer hook', hook.includes('useWorkoutTimerEngine'));
record('Workout overlay traditional rest', overlay.includes('Rest Timer'));
record('Workout overlay interval config', overlay.includes('Work (sec)') && overlay.includes('Rounds'));
record('Workout overlay circuit transition', overlay.includes('Circuit'));
record('Active workout uses timer engine', active.includes('useWorkoutTimerEngine'));
record('Active workout passes execution mode', read('src/app/(tabs)/workout/index.tsx').includes('executionMode'));
record('Cardio tabata 10 rounds', cardio.includes('rounds: 10'));
record('Interval panel uses timer engine', read('src/components/cardio/IntervalTimerPanel.tsx').includes('timerEngine'));

console.log('\nTimer architecture: timerEngine → useWorkoutTimerEngine → WorkoutTimerOverlay');
console.log('Modes: traditional rest · HIIT/tabata intervals · circuit transitions');

const pass = checks.filter((c) => c.pass).length;
const total = checks.length;
console.log(`\nSummary: ${pass}/${total} checks`);

if (pass !== total) process.exit(1);
