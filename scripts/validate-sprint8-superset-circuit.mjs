#!/usr/bin/env node
/**
 * Sprint 8 — Superset & Circuit Engine validation
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

console.log('=== Sprint 8 Superset & Circuit Engine ===\n');

for (const file of [
  'src/lib/supersetFlow.ts',
  'src/components/workout/execution/ActiveWorkoutScreen.tsx',
  'src/components/workout/execution/WorkoutExerciseDetailList.tsx',
  'backend/src/lib/programEngine.ts',
]) {
  record(`File exists: ${file}`, fs.existsSync(path.join(root, file)));
}

const flow = read('src/lib/supersetFlow.ts');
const active = read('src/components/workout/execution/ActiveWorkoutScreen.tsx');
const detail = read('src/components/workout/execution/WorkoutExerciseDetailList.tsx');
const program = read('backend/src/lib/programEngine.ts');

record('No blanket auto-pairing fallback', !flow.includes('for (let i = 0; i + 1 < result.length; i += 2)'));
record('A1/A2 station labels', flow.includes('formatSupersetStationLabel') && flow.includes('formatExerciseStationLabel'));
record('Circuit station builder', flow.includes('buildCircuitStations'));
record('Post-set flow resolver', flow.includes('resolvePostSetFlowAction'));
record('Circuit round rest phase', flow.includes("'round_rest'") && flow.includes('circuitTimer'));
record('Circuit round tracking in active workout', active.includes('circuitRound') && active.includes('setCircuitRound'));
record('Uses resolvePostSetFlowAction', active.includes('resolvePostSetFlowAction'));
record('Station label in active workout', active.includes('formatExerciseStationLabel'));
record('Replace/day overview station labels', detail.includes('formatExerciseStationLabel'));
record('Backend planner owns smart superset enrichment', read('backend/src/lib/workoutPlanner.ts').includes('enrichWithSmartSupersetGroups'));
record('Auto superset execution mode', flow.includes('inferExecutionModeFromPlan'));
record('Superset position resolver', flow.includes('resolveSupersetWorkoutPosition'));
record('Superset prep detection', flow.includes('shouldShowSupersetPrep'));
record('Superset prep banner', fs.existsSync(path.join(root, 'src/components/workout/execution/SupersetPrepBanner.tsx')));
record('Workout tab infers superset mode', read('src/app/(tabs)/workout/index.tsx').includes('inferExecutionModeFromPlan'));
record('Active workout superset banner', active.includes('SupersetPrepBanner'));
record('Watch rest-only sync', read('src/services/watchCompanionService.ts').includes('pushRestTimerOnly'));

console.log('\nFlow: explicit plan groups → resolvePostSetFlowAction → timer/advance');
console.log('Labels: A1 Bench Press · A2 Row · Circuit Round N');

const pass = checks.filter((c) => c.pass).length;
const total = checks.length;
console.log(`\nSummary: ${pass}/${total} checks`);

if (pass !== total) process.exit(1);
