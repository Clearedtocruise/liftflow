import assert from 'node:assert/strict';
import test from 'node:test';

import { eachSideLabelForSet, expandSetsForEachSide, looksLikeEachSide } from './eachSideSets';

test('detects common each-side phrasings', () => {
  assert.equal(looksLikeEachSide('Each side'), true);
  assert.equal(looksLikeEachSide('30 sec /side'), true);
  assert.equal(looksLikeEachSide('left and right'), true);
  assert.equal(looksLikeEachSide('Timed hold'), false);
});

test('expands 3 sets each side into 6 loggable holds', () => {
  assert.equal(expandSetsForEachSide(3, 'Each side'), 6);
  assert.equal(expandSetsForEachSide(3, 'Timed hold'), 3);
});

test('labels odd holds Left and even holds Right', () => {
  assert.equal(eachSideLabelForSet(1, 'Each side'), 'Left');
  assert.equal(eachSideLabelForSet(2, 'Each side'), 'Right');
  assert.equal(eachSideLabelForSet(3, 'Each side'), 'Left');
  assert.equal(eachSideLabelForSet(4, 'Each side'), 'Right');
  assert.equal(eachSideLabelForSet(1, 'Timed hold'), null);
});
