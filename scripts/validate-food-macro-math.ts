/**
 * Guards for Smart Replacement macro math — totals must match the itemized paragraph.
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  try {
    assert.deepEqual(actual, expected);
    console.log(`  PASS — ${label}`);
  } catch {
    failures += 1;
    console.log(`  FAIL — ${label}`);
    console.log(`         expected ${JSON.stringify(expected)}`);
    console.log(`         actual   ${JSON.stringify(actual)}`);
  }
}

async function main() {
  console.log('Smart replacement macro math');

  const {
    reconcileFoodMacroEstimate,
    estimateFoodMacrosLocal,
    sumMacroComponents,
    formatMacroReasoning,
  } = await import(pathToFileURL(join(root, 'backend/src/lib/foodMacroEstimator.ts')).href);
  const client = await import(
    pathToFileURL(join(root, 'src/lib/reconcileFoodMacroEstimate.ts')).href
  );

  const badReasoning =
    'Oikos Triple Zero Greek Yogurt typically contains around 100 calories, 15g of protein, 5g of carbs, and 0g of fat per serving. ' +
    'A standard serving of blueberries (about 1 cup) adds approximately 85 calories, 1g of protein, 21g of carbs, and 0.5g of fat. ' +
    'A tablespoon of peanut butter adds about 95 calories, 4g of protein, 3g of carbs, and 8g of fat. ' +
    'Combining these estimates gives a total of approximately 350 calories, 25g of protein, 30g of carbs, and 15g of fat.';

  const fixed = reconcileFoodMacroEstimate({
    calories: 350,
    proteinG: 25,
    carbsG: 30,
    fatG: 15,
    reasoning: badReasoning,
  });

  check('backend reconcile calories', fixed.calories, 280);
  check('backend reconcile protein', fixed.proteinG, 20);
  check('backend reconcile carbs', fixed.carbsG, 29);
  check('backend reconcile fat', fixed.fatG, 8.5);
  check(
    'backend rewrite closing total',
    fixed.reasoning?.includes('280 calories, 20g of protein, 29g of carbs, and 8.5g of fat'),
    true,
  );

  const clientFixed = client.reconcileFoodMacroEstimate({
    calories: 350,
    proteinG: 25,
    carbsG: 30,
    fatG: 15,
    reasoning: badReasoning,
  });
  check('client reconcile calories', clientFixed.calories, 280);

  const local = estimateFoodMacrosLocal(
    'oikos triple zero greek yogurt (100cal), blueberries, and peanut butter',
    '1',
  );
  check('local multi-food calories are finite', Number.isFinite(local.calories), true);
  check('local reasoning includes Total', local.reasoning?.includes('Total:') ?? false, true);

  const components = [
    { name: 'Yogurt', calories: 100, proteinG: 15, carbsG: 5, fatG: 0 },
    { name: 'Blueberries', calories: 85, proteinG: 1, carbsG: 21, fatG: 0.5 },
    { name: 'Peanut butter', calories: 95, proteinG: 4, carbsG: 3, fatG: 8 },
  ];
  const summed = sumMacroComponents(components);
  check('sum components calories', summed.calories, 280);
  check(
    'formatted reasoning uses summed total',
    formatMacroReasoning(components, summed).includes('Total: 280 calories'),
    true,
  );

  console.log(`\nFood macro math: ${failures === 0 ? 'PASS' : `FAIL (${failures})`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
