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

  const beefPref = adaptMealName('Lean salmon stir-fry with rice', 'dinner', {
    dietaryRestrictions: [],
    foodPreferences: ['Lean beef'],
  });
  assert.match(beefPref.name.toLowerCase(), /lean beef/);
  assert.doesNotMatch(beefPref.name.toLowerCase(), /lean lean beef/);

  // Already-adapted names must stay stable if adaptMealName runs twice.
  const twice = adaptMealName(beefPref.name, 'dinner', {
    dietaryRestrictions: [],
    foodPreferences: ['Lean beef'],
  });
  assert.equal(twice.name, beefPref.name);

  console.log('nutritionPreferenceEngine.test.ts — 5/5 PASS');
}

run();
