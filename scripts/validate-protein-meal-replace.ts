/**
 * Guards the bug where replacing a meal left home protein at "—" with a goal.
 *
 * Replacements wrote status=modified into instructions JSON only; the meals.status
 * column stayed planned, so isConsumedMeal ignored the food and home showed Goal 194g.
 *
 * Usage: npx tsx scripts/validate-protein-meal-replace.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isConsumedMeal } from '@/lib/mealAggregation';
import { buildSmartMealReplacementUpdate } from '@/lib/mealReplacement';
import { serializeMealMeta } from '@/lib/mealIngredients';
import type { Meal } from '@/types';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failures += 1;
  console.log(
    `  ${pass ? 'PASS' : 'FAIL'} — ${label}${pass ? '' : ` (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`,
  );
}

const repoRoot = join(__dirname, '..');
const source = (path: string) => readFileSync(join(repoRoot, path), 'utf8');

const planned: Meal = {
  id: 'm1',
  userId: 'u1',
  mealType: 'pre_workout',
  name: 'Pre-workout banana and oats',
  scheduledDate: '2026-07-27',
  calories: 200,
  proteinG: 10,
  carbsG: 30,
  fatG: 4,
  status: 'planned',
  origin: 'plan',
  macrosProvided: true,
  createdAt: '2026-07-27T00:00:00.000Z',
};

console.log('\nA replaced meal counts as eaten even when the column was left planned');
const legacyReplaced: Meal = {
  ...planned,
  name: 'optimim whey protein and half a banana',
  calories: 150,
  proteinG: 25,
  carbsG: 15,
  fatG: 2,
  status: 'planned',
  instructions: serializeMealMeta({
    status: 'modified',
    ingredients: [{ name: 'Whey protein', serving: '1 scoop' }],
  }),
};
check('legacy replaced meal is consumed', isConsumedMeal(legacyReplaced), true);
check('untouched plan meal is not consumed', isConsumedMeal(planned), false);
check(
  'column-completed meal is consumed',
  isConsumedMeal({ ...planned, status: 'completed' }),
  true,
);

console.log('\nReplacement updates write the status column, not just instructions');
const smart = buildSmartMealReplacementUpdate(planned, {
  foodName: 'optimim whey protein and half a banana',
  servingSize: '1 serving',
  macros: { calories: 150, proteinG: 25, carbsG: 15, fatG: 2 },
});
check('smart meal replace sets status modified', smart.status, 'modified');
check('smart meal replace keeps protein', smart.proteinG, 25);

const nutrition = source('src/app/(tabs)/nutrition/index.tsx');
const replacement = source('src/lib/mealReplacement.ts');
const aggregation = source('src/lib/mealAggregation.ts');
check(
  'handleReplaceMeal updates the status column',
  nutrition.includes("status: 'modified'") && nutrition.includes('handleReplaceMeal'),
  true,
);
check(
  'ingredient replace updates the status column',
  nutrition.includes('handleReplaceIngredient') &&
    /handleReplaceIngredient[\s\S]*?status: 'modified'/.test(nutrition),
  true,
);
check('smart builders include status', replacement.includes("status: 'modified'"), true);
check(
  'isConsumedMeal honors instructions metadata',
  aggregation.includes('enrichMealMeta(meal.name, meal.instructions)'),
  true,
);

console.log(`\nProtein meal replace: ${failures === 0 ? 'PASS' : `FAIL (${failures})`}`);
process.exit(failures === 0 ? 0 : 1);
