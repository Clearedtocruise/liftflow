import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveSwapTargetIndex, type SwapCandidate } from './workoutSwapTarget';

function candidates(...pairs: [logged: number, target: number][]): SwapCandidate[] {
  return pairs.map(([loggedSets, targetSets]) => ({ loggedSets, targetSets }));
}

test('swap on an unstarted exercise replaces that exercise', () => {
  assert.equal(resolveSwapTargetIndex(1, candidates([3, 3], [0, 3], [0, 3])), 1);
});

test('swap part way through an exercise still replaces the one on screen', () => {
  // Overhead press, two of three sets in, shoulder complains. Swap has to mean this lift.
  assert.equal(resolveSwapTargetIndex(1, candidates([3, 3], [2, 3], [0, 3])), 1);
  assert.equal(resolveSwapTargetIndex(0, candidates([1, 3], [0, 3])), 0);
});

test('swap on a finished exercise replaces the next one that has no sets', () => {
  assert.equal(resolveSwapTargetIndex(0, candidates([3, 3], [0, 3], [0, 3])), 1);
  assert.equal(resolveSwapTargetIndex(0, candidates([3, 3], [2, 3], [0, 3])), 2);
});

test('an exercise carried past its target still counts as finished', () => {
  assert.equal(resolveSwapTargetIndex(0, candidates([4, 3], [0, 3])), 1);
});

test('swap stays on the current exercise when every later lift is already logged', () => {
  assert.equal(resolveSwapTargetIndex(0, candidates([3, 3], [3, 3])), 0);
});

test('an exercise with no target is never treated as finished', () => {
  assert.equal(resolveSwapTargetIndex(0, candidates([2, 0], [0, 3])), 0);
});

test('an out of range index clamps into the workout', () => {
  assert.equal(resolveSwapTargetIndex(9, candidates([0, 3], [0, 3])), 1);
  assert.equal(resolveSwapTargetIndex(-2, candidates([0, 3], [0, 3])), 0);
});
