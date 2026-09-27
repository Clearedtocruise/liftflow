import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveSwapTargetIndex } from './workoutSwapTarget';

test('swap on an unstarted exercise replaces that exercise', () => {
  assert.equal(resolveSwapTargetIndex(1, [3, 0, 0]), 1);
});

test('swap on a finished exercise replaces the next one that has no sets', () => {
  assert.equal(resolveSwapTargetIndex(0, [3, 0, 0]), 1);
  assert.equal(resolveSwapTargetIndex(0, [3, 2, 0]), 2);
});

test('swap stays on the current exercise when every later lift is already logged', () => {
  assert.equal(resolveSwapTargetIndex(0, [3, 3]), 0);
});
