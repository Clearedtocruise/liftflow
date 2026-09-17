/**
 * Guards logging a hold — planks, side planks, dead hangs, wall sits.
 *
 * The reported failure: "Plank is getting stuck at 30 seconds. I can't log 60 seconds." The
 * duration field was seeded from the plan again on every session refresh, so a 60 second hold was
 * pushed back to the plan's 30 between sets and out from under the lifter mid-entry.
 *
 * Usage: npm run validate:timed-hold-logging
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { resolveExerciseInputSeed } from '@/lib/activeWorkoutWeightSeed';
import {
  defaultTimedDurationSeconds,
  getExerciseLoggingMode,
  getExerciseLoggingModeByName,
} from '@/lib/exerciseModality';
import { parseVoiceCommandLocal } from '@/lib/voice/parseVoiceCommand';
import { FAST_PATH_CONFIDENCE } from '@/lib/voice/voicePlausibility';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failures += 1;
  console.log(
    `  ${pass ? 'PASS' : 'FAIL'} — ${label}${pass ? '' : ` (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`,
  );
}

const repoRoot = join(__dirname, '..');
function source(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

const activeWorkout = source('src/components/workout/execution/ActiveWorkoutScreen.tsx');
const controls = source('src/components/workout/execution/SetLoggingControls.tsx');
const confirmModal = source('src/components/workout/VoiceConfirmModal.tsx');

console.log('\nThe reported failure: a 60 second plank is not pulled back to the plan\u2019s 30');
// The duration field was re-seeded from the plan inside an effect that re-runs on every session
// refresh — and a session refresh follows every logged set.
check(
  'the duration field is not reset from the plan on each refresh',
  /setDurationSeconds\(defaultTimedDurationSeconds\(repRange\)\)/.test(activeWorkout),
  false,
);
check(
  'a value the lifter entered is remembered',
  /inputsTouchedRef/.test(activeWorkout),
  true,
);
check(
  'entering a duration marks the card as theirs',
  /handleChangeDuration[\s\S]{0,120}inputsTouchedRef\.current = true/.test(activeWorkout),
  true,
);
check(
  'the duration input is wired to that handler',
  /onChangeDuration=\{handleChangeDuration\}/.test(activeWorkout),
  true,
);
check(
  'history arriving does not overwrite what they entered',
  /if \(inputsTouchedRef\.current\) return;/.test(activeWorkout),
  true,
);
check(
  'taking the coach\u2019s number also counts as entering one',
  /handleApplyCoachTarget[\s\S]{0,400}inputsTouchedRef\.current = true/.test(activeWorkout),
  true,
);
check(
  'a fresh exercise card starts unclaimed again',
  /inputsTouchedRef\.current = false/.test(activeWorkout),
  true,
);

console.log('\nThe next set opens on the hold just completed');
check(
  'set two of a plank held for 60 opens at 60, not the plan\u2019s 30',
  resolveExerciseInputSeed({
    sessionSets: [{ durationSeconds: 60, reps: 1 }],
    planRepRange: '30 sec',
  }).durationSeconds,
  60,
);
check(
  'this session outranks a shorter hold from a previous one',
  resolveExerciseInputSeed({
    sessionSets: [{ durationSeconds: 60, reps: 1 }],
    historyDurationSeconds: 30,
    planRepRange: '30 sec',
  }).durationSeconds,
  60,
);
check(
  'the timed branch seeds through the shared helper, not from history alone',
  /mode === 'timed'[\s\S]{0,400}resolveExerciseInputSeed\(/.test(activeWorkout),
  true,
);

console.log('\nA prescription is read as written');
check('"60 sec" is a minute', defaultTimedDurationSeconds('60 sec'), 60);
check('"60" on a hold is a minute, not the 30 second fallback', defaultTimedDurationSeconds('60'), 60);
check('"30-60 sec" works up to the top end', defaultTimedDurationSeconds('30-60 sec'), 60);
check('"2 min" is converted, not read as 2 seconds', defaultTimedDurationSeconds('2 min'), 120);
check('"1:30" is not read as its first number', defaultTimedDurationSeconds('1:30'), 90);
check('nothing usable still falls back to 30', defaultTimedDurationSeconds('to failure'), 30);

console.log('\nNothing caps the field at 30');
check('the duration field has no maximum', /onIncrease=\{\(\) => onChangeDuration\(durationSeconds \+ 5\)\}/.test(controls), true);
check('only a floor of one second', /onChangeDuration\(Math\.max\(1, durationSeconds - 5\)\)/.test(controls), true);
check('typed durations are not clamped to a ceiling', /onChangeDuration\(Math\.max\(1, parsed\)\)/.test(controls), true);

console.log('\nPlank is recognised as a hold in the first place');
check('plank logs time', getExerciseLoggingModeByName('Plank'), 'timed');
check('side plank logs time', getExerciseLoggingModeByName('Side Plank'), 'timed');
check('wall sit logs time', getExerciseLoggingModeByName('Wall Sit'), 'timed');
check('a hold prescribed in seconds logs time', getExerciseLoggingMode(undefined, '45 sec', 'Ab Hold'), 'timed');

console.log('\nA hold can be said out loud');
for (const said of ['plank for 60 seconds', 'plank 60 seconds', 'plank for a minute']) {
  const parsed = parseVoiceCommandLocal(said, { activeExerciseName: 'Plank' });
  check(`"${said}" is heard as a hold`, parsed?.durationSeconds != null, true);
  check(`"${said}" saves without confirming`, (parsed?.confidence ?? 0) >= FAST_PATH_CONFIDENCE, true);
}
check('the time said is the time logged', parseVoiceCommandLocal('plank for 60 seconds', {})?.durationSeconds, 60);
check('a hold counts as one set', parseVoiceCommandLocal('plank for 60 seconds', {})?.reps, 1);
check(
  'a weighted set is still weight and reps',
  parseVoiceCommandLocal('bench press 225 for 8 reps', {})?.durationSeconds,
  undefined,
);
check(
  'an absurd hold is sent for confirmation',
  parseVoiceCommandLocal('plank for 4000 seconds', {})?.implausible,
  true,
);

console.log('\nThe spoken duration reaches the set that gets written');
check('the voice payload carries a duration', /durationSeconds\?: number;/.test(source('src/components/workout/VoiceSetLogger.tsx')), true);
check('a heard duration is committed', /commitSetLog\(\{[\s\S]{0,160}durationSeconds,/.test(activeWorkout), true);
check(
  'on a hold a bare number is seconds, not reps',
  /const durationSeconds = isHold \? \(payload\.durationSeconds \?\? payload\.reps\) : undefined;/.test(activeWorkout),
  true,
);
check(
  'a hold does not wait for a weight it will never have',
  /const isHold = parsed\.durationSeconds != null && !requiresWeight;/.test(
    source('src/components/workout/VoiceSetLogger.tsx'),
  ),
  true,
);

// A time heard on a loaded lift is a mis-parse. Committing it logs a single rep carrying nothing,
// which is what turned a spoken weight into "— lb × 1" on screen.
check(
  'a loaded lift never has a duration applied to it',
  /const durationSeconds = isHold \? [^\n]*: undefined;/.test(activeWorkout),
  true,
);
check(
  'a weight heard as a time is refused rather than logged empty',
  /Heard a time, not a weight/.test(activeWorkout),
  true,
);
check(
  'a weight named in the plural keeps its load',
  parseVoiceCommandLocal('dumbbell press 50s for 10', {})?.weight,
  50,
);
check(
  'a weight named in the plural is not read as a hold',
  parseVoiceCommandLocal('dumbbell press 50s for 10', {})?.durationSeconds,
  undefined,
);
check('the shorthand said mid-set carries its weight', parseVoiceCommandLocal('225 for 8', {})?.weight, 225);
check('a misheard hold can be corrected in seconds', /Duration \(sec\)/.test(confirmModal), true);
check('an empty rep box does not block saving a hold', /isHold \? parseInt\(duration, 10\) > 0/.test(confirmModal), true);

console.log(`\nTimed hold logging: ${failures === 0 ? 'PASS' : `FAIL (${failures})`}`);
process.exit(failures === 0 ? 0 : 1);
