import assert from 'node:assert/strict';

import { adaptMealName } from './nutritionPreferenceEngine.js';

function run() {
  const nutAllergy = adaptMealName('Protein shake with almonds', 'snack', {
    dietaryRestrictions: ['Nut allergy'],
  });
  assert.notEqual(nutAllergy.name, 'Protein shake with almonds');
  assert.equal(nutAllergy.reason, 'Nut allergy');

  const vegan = adaptMealName('Grilled chicken quinoa bowl', 'lunch', {
    dietaryRestrictions: ['Vegan'],
  });
  assert.match(vegan.name.toLowerCase(), /lentil|vegetable/);

  const pref = adaptMealName('Salmon with roasted vegetables', 'dinner', {
    dietaryRestrictions: [],
    foodPreferences: ['Chicken'],
  });
  assert.match(pref.name.toLowerCase(), /chicken/);

  console.log('nutritionPreferenceEngine.test.ts — 3/3 PASS');
}

run();
