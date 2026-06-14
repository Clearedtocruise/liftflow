import assert from 'node:assert/strict';

import {
    computeTimedProgression,
    formatDurationDelta,
    isTimedRepRange,
    parseTargetDurationSeconds,
} from './timedProgressionEngine.js';

function run() {
  assert.equal(parseTargetDurationSeconds('30 sec'), 30);
  assert.equal(parseTargetDurationSeconds('45-60 sec'), 45);
  assert.ok(isTimedRepRange('30 sec'));
  assert.ok(!isTimedRepRange('8-10'));

  const exceeded = computeTimedProgression({
    targetDurationSeconds: 30,
    priorSessionSets: [],
    currentSessionSets: [{ durationSeconds: 90, setNumber: 1 }],
  });
  assert.notEqual(exceeded.adjustmentLabel, 'deload' as never);
  assert.equal(exceeded.adjustmentLabel, 'increase_duration');
  assert.ok(exceeded.reason.includes('Exceeded 30s target by 60s'));
  assert.equal(formatDurationDelta(90, 30), 'Exceeded target by 60 sec');

  const shortHold = computeTimedProgression({
    targetDurationSeconds: 30,
    priorSessionSets: [],
    currentSessionSets: [{ durationSeconds: 20, setNumber: 1 }],
  });
  assert.equal(shortHold.adjustmentLabel, 'maintain');
  assert.ok(shortHold.reason.includes('10s short'));

  console.log('timedProgressionEngine.test.ts — 8/8 PASS');
}

run();
