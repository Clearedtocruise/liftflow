import assert from 'node:assert/strict';
import test from 'node:test';

import { areCoachChallengesEnabled, COACH_CHALLENGES_PREF_KEY } from './trainingPreferences';
import type { UserPreferences } from '@/types';

const withCoaching = (coachingPreferences: Record<string, unknown>) =>
  ({ coachingPreferences }) as unknown as UserPreferences;

test('coach challenges stay on until the lifter turns them off', () => {
  assert.equal(areCoachChallengesEnabled(null), true);
  assert.equal(areCoachChallengesEnabled(withCoaching({})), true);
  assert.equal(areCoachChallengesEnabled(withCoaching({ [COACH_CHALLENGES_PREF_KEY]: true })), true);
  assert.equal(areCoachChallengesEnabled(withCoaching({ [COACH_CHALLENGES_PREF_KEY]: false })), false);
});
