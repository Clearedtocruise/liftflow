import assert from 'node:assert/strict';
import test from 'node:test';

import { MANUAL_REPLACEMENT_REASON, exerciseToAlternativeOption } from './exerciseReplaceOption';

test('a catalog exercise converts into a replacement option', () => {
  const option = exerciseToAlternativeOption({
    id: 'ex-1',
    name: 'Hack Squat',
    slug: 'hack-squat',
    equipment: 'Machine',
    muscleGroups: ['quads', 'glutes'],
  });

  assert.equal(option.name, 'Hack Squat');
  assert.equal(option.slug, 'hack-squat');
  assert.equal(option.equipment, 'Machine');
  assert.deepEqual(option.muscleGroups, ['quads', 'glutes']);
  assert.equal(option.reason, MANUAL_REPLACEMENT_REASON);
});

test('a freshly created custom exercise still produces a usable option', () => {
  const option = exerciseToAlternativeOption({ name: '  Coach Smith Press  ' });

  assert.equal(option.name, 'Coach Smith Press');
  assert.equal(option.slug, 'coach-smith-press');
  assert.equal(option.equipment, 'Other');
  assert.deepEqual(option.muscleGroups, []);
});

test('the row id is the slug fallback so the list key stays stable', () => {
  const option = exerciseToAlternativeOption({ id: 'ex-42', name: 'Pendlay Row' });

  assert.equal(option.slug, 'ex-42');
});
