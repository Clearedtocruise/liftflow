/**
 * Guards how a replaced meal counts toward home protein.
 *
 * Originally replacing a meal wrote status=modified into instructions JSON only, so
 * isConsumedMeal ignored the food and home showed a bare goal. That was fixed by writing the
 * status column too — but counting a *replacement* as eaten inflated the day before the user
 * had eaten anything, so replace now leaves the meal planned and only "Ate as planned" /
 * "Modified" count it.
 *
 * Both rules still matter: legacy rows whose status lives in instructions must keep counting,
 * and a fresh replace must not.
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

console.log('\nReplacing a meal edits the plan and does not count until it is eaten');
const smart = buildSmartMealReplacementUpdate(planned, {
  foodName: 'optimim whey protein and half a banana',
  servingSize: '1 serving',
  macros: { calories: 150, proteinG: 25, carbsG: 15, fatG: 2 },
});
check('smart meal replace leaves the meal planned', smart.status, 'planned');
check('smart meal replace keeps protein', smart.proteinG, 25);
check(
  'a replaced-but-uneaten meal is not consumed',
  isConsumedMeal({ ...planned, ...smart } as Meal),
  false,
);
check(
  'the same meal counts once it is marked eaten',
  isConsumedMeal({ ...planned, ...smart, status: 'completed' } as Meal),
  true,
);

const nutrition = source('src/app/(tabs)/nutrition/index.tsx');
const replacement = source('src/lib/mealReplacement.ts');
const aggregation = source('src/lib/mealAggregation.ts');
check(
  'handleReplaceMeal writes the status column',
  /handleReplaceMeal[\s\S]*?status: 'planned'/.test(nutrition),
  true,
);
check(
  'ingredient replace writes the status column',
  nutrition.includes('handleReplaceIngredient') &&
    /handleReplaceIngredient[\s\S]*?status: 'planned'/.test(nutrition),
  true,
);
check('smart builders set a single status', replacement.includes("status: 'planned'"), true);
check(
  'smart builders no longer carry a duplicate status key',
  /status: 'planned',[\s\S]{0,400}?status: 'modified',/.test(replacement),
  false,
);
check(
  'isConsumedMeal honors instructions metadata',
  aggregation.includes('enrichMealMeta(meal.name, meal.instructions)'),
  true,
);

/**
 * Generating a week must never destroy the week it is replacing before the replacement exists.
 * The original order deleted first, so an empty API response, a rejected insert or a dropped
 * connection left the user with no meals at all and nothing to restore them.
 */
const nutritionService = source('src/services/nutritionService.ts');
const generateWeek = /async generateWeeklyMealPlan[\s\S]*?\n  },\n/.exec(nutritionService)?.[0] ?? '';

check('generateWeeklyMealPlan was found', generateWeek.length > 0, true);

const insertIndex = generateWeek.indexOf(".from('meals')\n        .insert(");
const deleteIndex = generateWeek.indexOf(".from('meals').delete()");

check('the new week is inserted before anything is deleted', insertIndex > 0 && insertIndex < deleteIndex, true);
check(
  'the meals it replaces are still cleaned up afterwards',
  generateWeek.includes('staleMealIds') && deleteIndex > 0,
  true,
);
check(
  'the pre-emptive week wipe is gone',
  /await this\.removePlannedMealsForWeek\(userId, clientWeekStart\);[\s\S]{0,200}?const apiMeals/.test(generateWeek),
  false,
);

console.log(`\nProtein meal replace: ${failures === 0 ? 'PASS' : `FAIL (${failures})`}`);
process.exit(failures === 0 ? 0 : 1);
