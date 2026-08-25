import assert from 'node:assert/strict';
import test from 'node:test';

import { hasBasicFeature, isBasicSubscription, isProSubscription } from './entitlements';
import type { Subscription } from '@/types/platform';

function sub(partial: Partial<Subscription>): Subscription {
  return {
    id: 'sub-1',
    userId: 'user-1',
    tier: 'free',
    status: 'active',
    createdAt: new Date().toISOString(),
    ...partial,
  } as Subscription;
}

test('a Basic subscription unlocks custom programs but not Pro features', () => {
  const basic = sub({ tier: 'basic', status: 'active' });
  assert.equal(isBasicSubscription(basic), true);
  assert.equal(isProSubscription(basic), false);
  assert.equal(hasBasicFeature(basic, 'custom-programs'), true);
});

test('a Pro subscription is a superset of Basic', () => {
  const pro = sub({ tier: 'premium', status: 'active' });
  assert.equal(isBasicSubscription(pro), true);
  assert.equal(isProSubscription(pro), true);
  assert.equal(hasBasicFeature(pro, 'custom-programs'), true);
});

test('free users cannot access custom programs', () => {
  const free = sub({ tier: 'free', status: 'active' });
  assert.equal(isBasicSubscription(free), false);
  assert.equal(hasBasicFeature(free, 'custom-programs'), false);
  assert.equal(hasBasicFeature(null, 'custom-programs'), false);
});

test('an expired Basic subscription loses access', () => {
  const expired = sub({ tier: 'basic', status: 'expired' });
  assert.equal(isBasicSubscription(expired), false);
  assert.equal(hasBasicFeature(expired, 'custom-programs'), false);
});

test('a cancelled Basic subscription keeps access until the period ends', () => {
  const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  assert.equal(isBasicSubscription(sub({ tier: 'basic', status: 'cancelled', currentPeriodEnd: future })), true);
  assert.equal(isBasicSubscription(sub({ tier: 'basic', status: 'cancelled', currentPeriodEnd: past })), false);
});

test('unknown feature ids are not gated', () => {
  assert.equal(hasBasicFeature(null, 'not-a-basic-feature' as never), true);
});
