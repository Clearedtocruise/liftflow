import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isSelfDirectedNutrition,
  isSelfDirectedTraining,
  selfDirectedNutritionSummary,
  selfDirectedTrainingSummary,
} from './selfDirectedMode';

describe('selfDirectedMode', () => {
  it('defaults to coach-directed', () => {
    assert.equal(isSelfDirectedTraining(null), false);
    assert.equal(isSelfDirectedNutrition(undefined), false);
    assert.equal(isSelfDirectedTraining({ metadata: {} } as never), false);
  });

  it('reads coachProfile flags', () => {
    const user = {
      metadata: {
        coachProfile: {
          selfDirectedTraining: true,
          selfDirectedNutrition: true,
        },
      },
    } as Parameters<typeof isSelfDirectedTraining>[0];

    assert.equal(isSelfDirectedTraining(user), true);
    assert.equal(isSelfDirectedNutrition(user), true);
  });

  it('summarizes for Settings', () => {
    assert.equal(selfDirectedTrainingSummary(true), 'You log your own');
    assert.equal(selfDirectedTrainingSummary(false), 'Coach plans your week');
    assert.equal(selfDirectedNutritionSummary(true), 'You log your own');
    assert.equal(selfDirectedNutritionSummary(false), 'Coach meal plans');
  });
});
