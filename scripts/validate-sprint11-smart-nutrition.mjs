#!/usr/bin/env node
/**
 * Sprint 11 — Smart Nutrition Replacements validation
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const checks = [];
function record(name, pass, detail = '') {
  checks.push({ name, pass, detail });
  console.log(`  ${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ' — ' + detail : ''}`);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

console.log('=== Sprint 11 Smart Nutrition Replacements ===\n');

for (const file of [
  'src/components/nutrition/SmartMealReplaceForm.tsx',
  'src/lib/mealReplacement.ts',
  'src/lib/foodMacroLookup.ts',
  'backend/src/lib/foodMacroEstimator.ts',
]) {
  record(`File exists: ${file}`, fs.existsSync(path.join(root, file)));
}

const sheet = read('src/components/nutrition/MealReplaceSheet.tsx');
const form = read('src/components/nutrition/SmartMealReplaceForm.tsx');
const card = read('src/components/nutrition/MealPlanCard.tsx');
const index = read('src/app/(tabs)/nutrition/index.tsx');
const advisory = read('src/services/nutritionAdvisoryService.ts');
const nutrition = read('src/services/nutritionService.ts');
const replacement = read('src/lib/mealReplacement.ts');
const aiRoute = read('backend/src/routes/ai.ts');
const estimator = read('backend/src/lib/foodMacroEstimator.ts');

record('Smart vs AI replacement modes', sheet.includes('Smart Replacement') && sheet.includes('AI Replacement'));
record('Smart form food + serving inputs', form.includes('Food') && form.includes('Serving size'));
record('Calculate macros action', form.includes('Calculate Macros'));
record('Macro preview grid', form.includes('Estimated nutrition') && form.includes('Protein'));
record('Apply scope options', form.includes('This meal only') && form.includes('Entire week'));
record('Per-ingredient Replace on meal card', card.includes('Replace') && card.includes('onReplaceIngredient'));
record('Client estimateFoodMacros service', advisory.includes('food-macros'));
record('Backend food-macros route', aiRoute.includes('/advisory/nutrition/food-macros'));
record('Backend macro estimator', estimator.includes('estimateFoodMacros'));
record('Local macro fallback', read('src/lib/foodMacroLookup.ts').includes('estimateFoodMacrosLocal'));
record('Scope selection helper', replacement.includes('selectMealsForScope'));
record('Ingredient replacement macro diff', replacement.includes('buildSmartIngredientReplacementUpdate'));
record('Smart replace handler in nutrition screen', index.includes('handleSmartReplace'));
record('Grocery list sync after replace', nutrition.includes('syncGroceryListFromMeals'));
record('AI replacement preserved', sheet.includes('getMealAlternatives'));

console.log('\nFlow: Replace → Smart | AI → food + serving → macros → scope → save');
console.log('Totals: meal macros · daily header · shopping list');

const pass = checks.filter((c) => c.pass).length;
const total = checks.length;
console.log(`\nSummary: ${pass}/${total} checks`);

if (pass !== total) process.exit(1);
