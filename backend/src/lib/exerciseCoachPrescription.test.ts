import assert from 'node:assert/strict';

import {
    buildWhySelected,
    mapAdjustmentLabel,
    resolveTargetSets,
} from './exerciseCoachPrescription.js';

function run() {
  assert.equal(mapAdjustmentLabel('progressive_overload', 0), 'increase_weight');
  assert.equal(mapAdjustmentLabel('rep_progression', 0), 'increase_reps');
  assert.equal(mapAdjustmentLabel('hold', 1), 'increase_sets');
  assert.equal(mapAdjustmentLabel('deload', 0), 'deload');

  const deloadSets = resolveTargetSets(4, 40, 50, 'deload', 1);
  assert.equal(deloadSets.sets, 3);
  assert.ok(deloadSets.setsDelta < 0);

  const boostSets = resolveTargetSets(2, 90, 85, 'accumulation', 1, 'train');
  assert.equal(boostSets.sets, 3);
  assert.equal(boostSets.setsDelta, 1);

  const noBoostPastThree = resolveTargetSets(3, 90, 85, 'accumulation', 1, 'train');
  assert.equal(noBoostPastThree.sets, 3);
  assert.equal(noBoostPastThree.setsDelta, 0);

  const noBoostWhenLight = resolveTargetSets(3, 90, 85, 'accumulation', 1, 'train_light');
  assert.equal(noBoostWhenLight.sets, 3);

  const pushWhy = buildWhySelected({
    exerciseName: 'Bench Press',
    goalFocus: 'hypertrophy',
    recoveryScore: 82,
    readinessScore: 88,
    sprintPhase: 'intensification',
    equipment: ['barbell', 'bench'],
    trainingRecommendation: 'train',
  });
  assert.ok(pushWhy.some((line) => line.includes('readiness is high')));

  const lightWhy = buildWhySelected({
    exerciseName: 'Bench Press',
    goalFocus: 'hypertrophy',
    recoveryScore: 62,
    readinessScore: 88,
    trainingRecommendation: 'train_light',
  });
  assert.ok(lightWhy.some((line) => line.includes('training light')));
  assert.ok(!lightWhy.some((line) => line.includes('readiness is high')));

  const why = pushWhy;
  assert.ok(why.length >= 2);
  assert.ok(why.some((line) => line.includes('hypertrophy')));

  console.log('exerciseCoachPrescription.test.ts — 6/6 PASS');
}

run();
