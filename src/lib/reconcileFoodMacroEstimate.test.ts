import assert from 'node:assert/strict';
import test from 'node:test';

import { reconcileFoodMacroEstimate } from './reconcileFoodMacroEstimate';

test('sums egg whites narrated without a full macro tuple', () => {
  const result = reconcileFoodMacroEstimate({
    calories: 210,
    proteinG: 18,
    carbsG: 0,
    fatG: 15,
    reasoning:
      'Three whole eggs contain approximately 210 calories, 18g of protein, 0g of carbs, and 15g of fat. A half cup of egg whites adds about 60 calories and 12g of protein, with negligible carbs and fat. Combined, this results in a total of 210 calories, 24g of protein, 1g of carbs, and 14g of fat.',
  });

  assert.equal(result.calories, 270);
  assert.equal(result.proteinG, 30);
  assert.equal(result.carbsG, 0);
  assert.equal(result.fatG, 15);
  assert.match(result.reasoning ?? '', /270 calories, 30g of protein/);
  assert.doesNotMatch(result.reasoning ?? '', /total of 210 calories, 24g/);
});
