import assert from 'node:assert/strict';

import {
  MISSING_INPUT_DEFAULT_SCORE,
  SUBJECTIVE_INPUT_WEIGHTS,
  calculateRecoveryScore,
  describeSubjectiveInputs,
  mergeTrainingLoadScore,
} from './recoveryScore.js';

function run() {
  const fullCheckIn = calculateRecoveryScore({
    sleepHours: 8,
    sleepQuality: 8,
    energyLevel: 8,
    stressLevel: 3,
    sorenessLevel: 3,
  });
  assert.equal(fullCheckIn.recoveryScore, 85);
  assert.equal(fullCheckIn.status, 'optimal');

  const emptyCheckIn = calculateRecoveryScore({});
  assert.equal(emptyCheckIn.recoveryScore, MISSING_INPUT_DEFAULT_SCORE);
  assert.equal(emptyCheckIn.status, 'moderate');

  const described = describeSubjectiveInputs({ sleepHours: 8 });
  assert.equal(described.estimatedFromDefaults, true);
  assert.deepEqual(described.missingInputs, ['sleepQuality', 'energyLevel', 'stressLevel', 'sorenessLevel']);
  assert.equal(described.breakdown.find((row) => row.key === 'sleepHours')?.provided, true);
  assert.equal(described.breakdown.find((row) => row.key === 'energyLevel')?.score, MISSING_INPUT_DEFAULT_SCORE);

  const weightSum = Object.values(SUBJECTIVE_INPUT_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
  assert.ok(Math.abs(weightSum - 1) < 0.001);

  assert.equal(mergeTrainingLoadScore(80, 4, 60000), 65);
  assert.equal(mergeTrainingLoadScore(80, 2, 10000), 80);

  console.log('recoveryScore.test.ts — 6/6 PASS');
}

run();
