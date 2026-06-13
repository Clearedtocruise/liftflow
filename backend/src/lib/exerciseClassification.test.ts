import assert from 'node:assert/strict';
import { catalogCountsByType, classifyExercise } from './exerciseClassification.js';

const cases: Array<{ label: string; input: Parameters<typeof classifyExercise>[0]; expected: string }> = [
  { label: 'Bench Press', input: { slug: 'bench-press', name: 'Bench Press', equipment: 'barbell' }, expected: 'strength' },
  { label: 'Pull Up', input: { slug: 'pull-up', name: 'Pull Up', equipment: 'bodyweight' }, expected: 'bodyweight' },
  { label: 'Push Up', input: { slug: 'push-up', name: 'Push-Up', equipment: 'bodyweight' }, expected: 'bodyweight' },
  { label: 'Plank', input: { slug: 'plank', name: 'Plank', equipment: 'bodyweight' }, expected: 'timed' },
  { label: 'Side Plank', input: { slug: 'side-plank', name: 'Side Plank', equipment: 'bodyweight' }, expected: 'timed' },
  { label: 'Running', input: { slug: 'running', name: 'Running', movementCategory: 'cardio' }, expected: 'cardio' },
  { label: 'Swimming', input: { slug: 'swimming', name: 'Swimming', movementCategory: 'cardio' }, expected: 'cardio' },
  { label: 'Cycling', input: { slug: 'cycling', name: 'Cycling', equipment: 'bike' }, expected: 'cardio' },
  { label: 'Inferred custom plank', input: { name: 'Front Plank Hold', equipment: 'bodyweight' }, expected: 'timed' },
  { label: 'Inferred custom run', input: { name: 'Easy Run', equipment: 'none' }, expected: 'cardio' },
];

for (const testCase of cases) {
  assert.equal(classifyExercise(testCase.input), testCase.expected, testCase.label);
}

const counts = catalogCountsByType();
assert.equal(counts.strength, 26);
assert.equal(counts.bodyweight, 4);
assert.equal(counts.timed, 2);
assert.equal(counts.cardio, 5);
assert.equal(counts.strength + counts.bodyweight + counts.timed + counts.cardio, 37);

console.log('exerciseClassification.test.ts — all assertions passed');
