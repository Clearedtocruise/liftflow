import assert from 'node:assert/strict';

import { calculateMacroTargets, type NutritionContext } from './workoutAwareNutrition.js';

const CASES: NutritionContext[] = [
  { goal: 'fat_loss', bodyWeightKg: 60 },
  { goal: 'fat_loss', bodyWeightKg: 110, dietaryStyle: 'keto' },
  { goal: 'muscle_gain', bodyWeightKg: 85, workoutType: 'leg' },
  { goal: 'strength', bodyWeightKg: 75, dietaryStyle: 'low_carb' },
  { goal: 'general_fitness', bodyWeightKg: 95, workoutType: 'rest' },
  { goal: 'fat_loss', bodyWeightKg: 70, recoveryModeActive: true, ageYears: 58 },
  { goal: 'fat_loss', bodyWeightKg: 45, dietaryStyle: 'keto' },
];

function run() {
  for (const ctx of CASES) {
    const macros = calculateMacroTargets(ctx);
    const fromGrams = macros.proteinG * 4 + macros.carbsG * 4 + macros.fatG * 9;

    assert.ok(
      Math.abs(fromGrams - macros.calories) <= 12,
      `macros must sum to calories for ${JSON.stringify(ctx)}: ${fromGrams} vs ${macros.calories}`,
    );
    assert.ok(macros.carbsG >= 0, 'carbs must not go negative');
    assert.ok(macros.fatG > 0, 'fat must stay above zero');

    if (ctx.dietaryStyle === 'keto') {
      assert.ok(macros.carbsG <= 50, `keto carb cap must survive reconciliation, got ${macros.carbsG}`);
    }
  }

  console.log(`# workoutAwareNutrition macro invariants: ${CASES.length}/${CASES.length} PASS`);
}

run();
