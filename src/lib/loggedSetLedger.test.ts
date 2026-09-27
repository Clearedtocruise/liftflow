import assert from 'node:assert/strict';
import test from 'node:test';

import { countLoggedSets, forgetLoggedSet, recordLoggedSet } from './loggedSetLedger';

test('a set logged before the refresh lands still counts', () => {
  // Two taps in a row: the second runs before the session refresh from the first has rendered, so
  // its copy of the set list is one behind. Without the ledger it reads 2, calls the third set
  // "Set 3 of 3" a second time, and lets a fourth set past a three-set plan.
  const ledger = recordLoggedSet({}, 'we-bench', 'set-3');
  const staleSessionSets = [{ id: 'set-1' }, { id: 'set-2' }];

  assert.equal(countLoggedSets(staleSessionSets, {}, 'we-bench'), 2);
  assert.equal(countLoggedSets(staleSessionSets, ledger, 'we-bench'), 3);
});

test('the refresh landing does not count the same set twice', () => {
  const ledger = recordLoggedSet({}, 'we-bench', 'set-3');
  const refreshed = [{ id: 'set-1' }, { id: 'set-2' }, { id: 'set-3' }];
  assert.equal(countLoggedSets(refreshed, ledger, 'we-bench'), 3);
});

test('the ledger is per exercise', () => {
  const ledger = recordLoggedSet(recordLoggedSet({}, 'we-bench', 'set-1'), 'we-row', 'set-2');
  assert.equal(countLoggedSets([], ledger, 'we-bench'), 1);
  assert.equal(countLoggedSets([], ledger, 'we-row'), 1);
  assert.equal(countLoggedSets([], ledger, 'we-squat'), 0);
});

test('recording the same set twice is a no-op', () => {
  const once = recordLoggedSet({}, 'we-bench', 'set-1');
  assert.equal(recordLoggedSet(once, 'we-bench', 'set-1'), once);
  assert.equal(countLoggedSets([], once, 'we-bench'), 1);
});

test('a deleted set leaves the ledger, so the exercise is not stuck full', () => {
  const ledger = recordLoggedSet(recordLoggedSet({}, 'we-bench', 'set-1'), 'we-bench', 'set-2');
  const afterDelete = forgetLoggedSet(ledger, 'set-2');
  assert.equal(countLoggedSets([{ id: 'set-1' }], afterDelete, 'we-bench'), 1);
  // Nothing to forget leaves the ledger untouched rather than rebuilding it.
  assert.equal(forgetLoggedSet(afterDelete, 'set-unknown'), afterDelete);
});

test('missing ids are ignored rather than creating blank entries', () => {
  assert.deepEqual(recordLoggedSet({}, null, 'set-1'), {});
  assert.deepEqual(recordLoggedSet({}, 'we-bench', undefined), {});
  assert.equal(countLoggedSets(undefined, {}, undefined), 0);
});
