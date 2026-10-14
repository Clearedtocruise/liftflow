#!/usr/bin/env node
/**
 * Sprint 5 — Active workout experience validation
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

console.log('=== Sprint 5 Active Workout Experience ===\n');

for (const file of [
  'src/components/workout/execution/ActiveWorkoutScreen.tsx',
  'src/components/workout/execution/GuidedWorkoutMetrics.tsx',
  'src/lib/activeWorkoutMetrics.ts',
  'src/hooks/useWorkoutElapsedSeconds.ts',
]) {
  record(`File exists: ${file}`, fs.existsSync(path.join(root, file)));
}

const active = read('src/components/workout/execution/ActiveWorkoutScreen.tsx');
const metrics = read('src/components/workout/execution/GuidedWorkoutMetrics.tsx');
const lib = read('src/lib/activeWorkoutMetrics.ts');
const elapsed = read('src/hooks/useWorkoutElapsedSeconds.ts');
const coach = read('src/components/workout/ExerciseCoachCard.tsx');
const workoutService = read('src/services/workoutService.ts');

record('Exercise number shown', active.includes('Exercise {currentIndex + 1} of'));
record('Workout Time label', active.includes('Workout Time') && active.includes('formatWorkoutClockTime'));
record('Workout progress bar', active.includes('WorkoutProgressBar'));
record('Current Set metric', metrics.includes('Current set'));
record('Remaining Sets metric', metrics.includes('Sets left'));
record('Previous Performance block', metrics.includes('Previous Performance'));
record('Target Performance block', metrics.includes('Target Performance'));
record('One exercise focus (currentIndex)', active.includes('currentIndex'));
// Sprint 5 kept the active screen to one exercise with no picker. Add / Swap Exercise were added
// deliberately afterwards, so the guard is now that the picker is reachable, not that it is absent.
record('Exercise picker available for add and swap', active.includes('ExercisePickerModal'));
record('Timed history support', workoutService.includes('duration_seconds') && workoutService.includes("mode === 'timed'"));
record('Coach enabled for timed exercises', !active.includes("loggingMode !== 'timed'"));
record('Progress computation helper', lib.includes('computeWorkoutSetProgress'));
record('Clock formatter', elapsed.includes('formatWorkoutClockTime'));

// Reported from TestFlight: "the exercise page is huge. Anyway to compress options and move rest
// timer up?" The running rest clock sat below the muscle figure, the metrics block and the coach
// card, so the thing the lifter was waiting on was off screen; and five full-width secondary
// buttons ran to roughly 300pt on their own.
record(
  'Running rest clock sits above the muscle figure, not below the coach card',
  active.indexOf('styles.restBanner') > -1 &&
    active.indexOf('styles.restBanner') < active.indexOf('<ExerciseMusclePanel'),
);
record(
  'Rest clock still stays out of the way once its own overlay is open',
  active.includes('restActive && !showComplete && !restOverlayOpen'),
);
record(
  'Secondary actions are compact rather than five stacked full-width buttons',
  active.includes('styles.extraActionsGrid') &&
    (active.match(/<CompactAction/g) ?? []).length >= 5,
);
record(
  'Compact actions keep the minimum touch target',
  /compactAction: \{[\s\S]*?minHeight: TouchTarget\.min/.test(active),
);
record(
  'Compact actions are still reachable by screen readers',
  /accessibilityRole="button"[\s\S]{0,200}accessibilityState=\{\{ disabled: Boolean\(disabled\) \}\}/.test(
    active,
  ),
);

console.log('\nGuided session fields: name · exercise # · current set · remaining · previous · target · time · progress');
console.log('Acceptance: one exercise at a time · no search · no exercise typing');

const pass = checks.filter((c) => c.pass).length;
const total = checks.length;
console.log(`\nSummary: ${pass}/${total} checks`);

if (pass !== total) process.exit(1);
