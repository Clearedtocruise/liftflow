import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { computeDailyDeficit } from '@/lib/dailyEnergyBalance';

describe('daily energy balance', () => {
  it('computes deficit from Apple burned and meal consumed', () => {
    assert.equal(computeDailyDeficit(900, 650), 250);
    assert.equal(computeDailyDeficit(400, 650), 0);
  });
});
