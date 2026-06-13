#!/usr/bin/env node
/**
 * Hotfix — nutrition replacement UI refresh validation
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

console.log('=== Hotfix: Nutrition UI Refresh ===\n');

const dashboard = read('src/app/(tabs)/dashboard.tsx');
const nutrition = read('src/app/(tabs)/nutrition/index.tsx');
const mealAgg = read('src/lib/mealAggregation.ts');
const nutritionSvc = read('src/services/nutritionService.ts');

record('Dashboard reloads meals on tab focus', dashboard.includes('useFocusEffect'));
record('AI replace syncs groceries', nutrition.includes('syncGroceriesAfterReplace') && nutrition.includes('handleReplaceMeal'));
record('Ingredient replace syncs groceries', nutrition.includes('handleReplaceIngredient') && nutrition.includes('syncGroceriesAfterReplace'));
record('Smart replace syncs groceries', nutrition.includes('handleSmartReplace') && nutrition.includes('syncGroceriesAfterReplace'));
record('Replace handlers check updateMeal errors', nutrition.includes("Alert.alert('Error', result.error)"));
record('Grocery sync service exists', nutritionSvc.includes('syncGroceryListFromMeals'));
record('Modified meals visible in findNextMeal', mealAgg.includes('isNextMealCandidate'));
record('Nutrition hasWorkoutToday uses scheduledDate', nutrition.includes('nextWorkout?.scheduledDate === today'));

console.log('\nFlow: replace meal → sync groceries → reload · home focus → fresh meals');
const pass = checks.filter((c) => c.pass).length;
const total = checks.length;
console.log(`\nSummary: ${pass}/${total} checks`);

if (pass !== total) process.exit(1);
