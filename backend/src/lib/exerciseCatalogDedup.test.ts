import assert from 'node:assert/strict';
import test from 'node:test';

import {
    isCatalogVariantSlug,
    normalizeExerciseName,
    partitionDuplicateExerciseSlugs,
    pickCanonicalExerciseSlug,
} from './exerciseCatalogDedup.js';

test('isCatalogVariantSlug detects scaffold import suffixes', () => {
  assert.equal(isCatalogVariantSlug('pallof-press-ch0046'), true);
  assert.equal(isCatalogVariantSlug('pallof-press'), false);
  assert.equal(isCatalogVariantSlug('lateral-raise-sh0199'), true);
});

test('pickCanonicalExerciseSlug prefers base slug and month1 canonical', () => {
  assert.equal(
    pickCanonicalExerciseSlug('Pallof Press', ['pallof-press-ch0046', 'pallof-press'], new Set(['pallof-press'])),
    'pallof-press',
  );
  assert.equal(
    pickCanonicalExerciseSlug('Lateral Raise', ['lateral-raise-sh0199', 'lateral-raise']),
    'lateral-raise',
  );
});

test('partitionDuplicateExerciseSlugs removes variant rows only', () => {
  const { keep, remove } = partitionDuplicateExerciseSlugs([
    { name: 'Pallof Press', slug: 'pallof-press' },
    { name: 'Pallof Press', slug: 'pallof-press-ch0046' },
    { name: 'Bench Press', slug: 'bench-press' },
  ]);

  assert.deepEqual(keep.sort(), ['bench-press', 'pallof-press']);
  assert.deepEqual(remove, ['pallof-press-ch0046']);
  assert.equal(normalizeExerciseName('Pallof  Press'), 'pallof press');
});
