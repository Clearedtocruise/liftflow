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

  const boostSets = resolveTargetSets(3, 90, 85, 'accumulation', 1);
  assert.equal(boostSets.sets, 4);
  assert.equal(boostSets.setsDelta, 1);

  const pushWhy = buildWhySelected({
    exerciseName: 'Bench Press',
    goalFocus: 'hypertrophy',
    readinessScore: 88,
    sprintPhase: 'intensification',
    equipment: ['barbell', 'bench'],
    trainingRecommendation: 'train',
  });
  assert.ok(pushWhy.some((line) => line.includes('readiness is high')));

  const lightWhy = buildWhySelected({
    exerciseName: 'Bench Press',
    goalFocus: 'hypertrophy',
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
