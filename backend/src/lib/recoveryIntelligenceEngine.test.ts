import assert from 'node:assert/strict';

import {
  RECOVERY_COMPOSITE_WEIGHTS,
  computeRecoveryIntelligence,
  computeMuscleRecovery,
} from './recoveryIntelligenceEngine.js';

function run() {
  const report = computeRecoveryIntelligence({
    checkIn: {
      sleepHours: 8,
      sleepQuality: 8,
      energyLevel: 8,
      stressLevel: 3,
      sorenessLevel: 3,
    },
    inputSources: { sleepHours: 'check_in' },
    sessions7d: [],
    sessions3d: [],
    consecutiveTrainingDays: 0,
    trendScores: [],
    sleepDataAvailable: false,
    healthKitAvailable: false,
  });

  assert.ok(report.recoveryScore >= 0 && report.recoveryScore <= 100);
  assert.equal(report.transparency.recoveryFormula.subjectiveWeight, RECOVERY_COMPOSITE_WEIGHTS.subjective);
  assert.equal(report.transparency.recoveryFormula.trainingLoadWeight, RECOVERY_COMPOSITE_WEIGHTS.trainingLoad);
  assert.equal(report.transparency.recoveryFormula.muscleReadinessWeight, RECOVERY_COMPOSITE_WEIGHTS.muscleReadiness);
  assert.equal(report.transparency.dataSources.checkIn, true);
  assert.equal(report.transparency.estimatedFromDefaults, false);
  assert.equal(report.factors.muscleReadinessScore, 98);

  const partial = computeRecoveryIntelligence({
    checkIn: { sleepHours: 8 },
    sessions7d: [],
    sessions3d: [],
    consecutiveTrainingDays: 0,
  });
  assert.equal(partial.transparency.estimatedFromDefaults, true);
  assert.ok(partial.transparency.missingInputs.length >= 4);

  const muscles = computeMuscleRecovery([], undefined);
  assert.equal(muscles.length, 7);
  assert.ok(muscles.every((muscle) => muscle.score === 98));

  console.log('recoveryIntelligenceEngine.test.ts — 5/5 PASS');
}

run();
