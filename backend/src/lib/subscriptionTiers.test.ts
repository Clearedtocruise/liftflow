import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  BASIC_MIN_RANK,
  PRO_MIN_RANK,
  subscriptionMeetsRank,
  tierForProductId,
  tierRank,
} from './subscriptionTiers.js';

test('tier ranking is monotonic free < basic < premium < premium_plus', () => {
  assert.ok(tierRank('free') < tierRank('basic'));
  assert.ok(tierRank('basic') < tierRank('premium'));
  assert.ok(tierRank('premium') < tierRank('premium_plus'));
  assert.equal(tierRank(null), 0);
  assert.equal(tierRank('nonsense'), 0);
});

test('Basic unlocks Basic routes but NOT Pro routes', () => {
  const basic = { tier: 'basic', status: 'active' };
  assert.equal(subscriptionMeetsRank(basic, BASIC_MIN_RANK), true);
  assert.equal(subscriptionMeetsRank(basic, PRO_MIN_RANK), false);
});

test('Pro subscribers satisfy Basic routes (superset)', () => {
  const pro = { tier: 'premium', status: 'active' };
  assert.equal(subscriptionMeetsRank(pro, BASIC_MIN_RANK), true);
  assert.equal(subscriptionMeetsRank(pro, PRO_MIN_RANK), true);
});

test('free and expired subscriptions unlock nothing', () => {
  assert.equal(subscriptionMeetsRank({ tier: 'free', status: 'active' }, BASIC_MIN_RANK), false);
  assert.equal(subscriptionMeetsRank({ tier: 'basic', status: 'expired' }, BASIC_MIN_RANK), false);
  assert.equal(subscriptionMeetsRank(null, BASIC_MIN_RANK), false);
});

test('a cancelled Basic subscription still works until the period ends', () => {
  const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  assert.equal(subscriptionMeetsRank({ tier: 'basic', status: 'cancelled', current_period_end: future }, BASIC_MIN_RANK), true);
  assert.equal(subscriptionMeetsRank({ tier: 'basic', status: 'cancelled', current_period_end: past }, BASIC_MIN_RANK), false);
});

test('product ids map to the tier they grant', () => {
  assert.equal(tierForProductId('com.liftflow.app.basic.monthly'), 'basic');
  assert.equal(tierForProductId('liftflow_basic_monthly'), 'basic');
  assert.equal(tierForProductId('com.liftflow.app.premium.monthly'), 'premium');
  assert.equal(tierForProductId('liftflow_premium_monthly'), 'premium');
  assert.equal(tierForProductId(null), null);
  assert.equal(tierForProductId('some_unknown_iap'), null);
});
