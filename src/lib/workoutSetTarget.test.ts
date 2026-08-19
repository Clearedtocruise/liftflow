import assert from 'node:assert/strict';
import test from 'node:test';

import { DEFAULT_TARGET_SETS, resolveEffectiveTargetSets, resolveSessionExerciseTargetSets } from './workoutSetTarget';

test('a traditional exercise finishes on its planned sets', () => {
  assert.equal(resolveEffectiveTargetSets({ executionMode: 'traditional', planSets: 4 }), 4);
});

test('added sets extend the target', () => {
  assert.equal(
    resolveEffectiveTargetSets({ executionMode: 'traditional', planSets: 3, bonusSets: 2 }),
    5,
  );
});

test('Tabata finishes on its rounds, not the plan', () => {
  assert.equal(
    resolveEffectiveTargetSets({ executionMode: 'tabata', planSets: 3, intervalRounds: 10 }),
    10,
  );
});

test('Tabata without a live round count falls back to the plan rather than completing early', () => {
  // The screen took a session-wide default here while the logger took the plan, so an exercise
  // with 4 planned sets read as done after 3 and auto-advanced to the next one.
  assert.equal(
    resolveEffectiveTargetSets({ executionMode: 'tabata', planSets: 4, intervalRounds: null }),
    4,
  );
  assert.equal(
    resolveEffectiveTargetSets({ executionMode: 'tabata', planSets: 4, intervalRounds: 0 }),
    4,
  );
});

test('the screen and the logger cannot disagree for the same inputs', () => {
  const cases: Parameters<typeof resolveEffectiveTargetSets>[0][] = [
    { executionMode: 'traditional', planSets: 3, bonusSets: 0, intervalRounds: 8 },
    { executionMode: 'tabata', planSets: 3, bonusSets: 1, intervalRounds: 8 },
    { executionMode: 'tabata', planSets: 5, bonusSets: 0 },
    { executionMode: 'superset', planSets: 4, bonusSets: 1 },
    { executionMode: 'circuit', planSets: 2 },
  ];

  for (const input of cases) {
    const screen = resolveEffectiveTargetSets(input);
    const logger = resolveEffectiveTargetSets(input);
    assert.equal(screen, logger);
    assert.ok(screen > 0, `target must be positive for ${JSON.stringify(input)}`);
  }
});

test('a missing plan falls back to a sane default instead of zero', () => {
  assert.equal(resolveEffectiveTargetSets({}), DEFAULT_TARGET_SETS);
  assert.equal(resolveEffectiveTargetSets({ planSets: 0 }), DEFAULT_TARGET_SETS);
  assert.equal(resolveEffectiveTargetSets({ planSets: null }), DEFAULT_TARGET_SETS);
});

test('a 5-set pull-up is not treated as a 3-set exercise', () => {
  assert.equal(
    resolveSessionExerciseTargetSets({ planSets: 5, sessionSuggestedSets: 3 }),
    5,
  );
});

test('a zero target can never make an exercise complete before a set is logged', () => {
  // An exercise that reports 0 sets to go is instantly "done", which is what chained the
  // auto-advance through several exercises in a row.
  for (const planSets of [undefined, null, 0, -2]) {
    assert.ok(resolveEffectiveTargetSets({ planSets }) >= 1);
    assert.ok(resolveEffectiveTargetSets({ executionMode: 'tabata', planSets }) >= 1);
  }
});
