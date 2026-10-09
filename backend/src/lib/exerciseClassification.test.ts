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
  {
    label: 'Windshield Wiper overrides bad generic strength metadata',
    input: { name: 'Windshield Wiper', equipment: 'dumbbell', exerciseType: 'strength' },
    expected: 'bodyweight',
  },
  {
    label: 'Weighted Sit-Up stays strength even when classified from name',
    input: { name: 'Weighted Sit-Up', equipment: 'dumbbell', exerciseType: 'strength' },
    expected: 'strength',
  },
  // A bare "row" used to classify as cardio, which put pulling lifts on the distance logger.
  { label: 'Hammer Row', input: { name: 'Hammer Row', equipment: 'machine' }, expected: 'strength' },
  { label: 'Hammer Row loaded strength', input: { slug: 'hammer-row', name: 'Hammer Row', equipment: 'dumbbell', exerciseType: 'strength' }, expected: 'strength' },
  { label: 'Hammer Low Row', input: { name: 'Hammer Low Row', equipment: 'machine' }, expected: 'strength' },
  { label: 'Seated Cable Row', input: { name: 'Seated Cable Row', equipment: 'cable' }, expected: 'strength' },
  { label: 'Bent Over Row', input: { name: 'Bent Over Row', equipment: 'barbell' }, expected: 'strength' },
  { label: 'Upright Row', input: { name: 'Upright Row', equipment: 'dumbbell' }, expected: 'strength' },
  { label: 'Inverted Row', input: { name: 'Inverted Row', equipment: 'bodyweight' }, expected: 'bodyweight' },
  { label: 'Rowing Machine', input: { name: 'Rowing Machine', equipment: 'machine' }, expected: 'cardio' },
  { label: 'Row Erg', input: { name: 'Row Erg', equipment: 'machine' }, expected: 'cardio' },
  { label: 'Rowing remains cardio', input: { name: 'Rowing', equipment: 'rower' }, expected: 'cardio' },
  // Loaded carries and walking lunges read as cardio but are weight-and-reps work.
  { label: 'Walking Lunge without slug', input: { name: 'Walking Lunge', equipment: 'dumbbell' }, expected: 'bodyweight' },
  { label: "Farmer's Walk", input: { name: "Farmer's Walk", equipment: 'dumbbell' }, expected: 'strength' },
  { label: 'Treadmill Walk', input: { name: 'Treadmill Walk', equipment: 'machine' }, expected: 'cardio' },
  // Leg throw downs are an ab movement — the load is the lifter's own legs, so the weighted
  // logger asked for a weight that does not exist.
  {
    label: 'Flat leg throw downs are bodyweight',
    input: { name: 'Flat Leg Throw Downs', equipment: 'bodyweight' },
    expected: 'bodyweight',
  },
  {
    label: 'Throw downs stay bodyweight even tagged as machine work',
    input: { name: 'Flat Leg Throwdowns', equipment: 'machine', exerciseType: 'strength' },
    expected: 'bodyweight',
  },
  { label: 'Bare throw downs', input: { name: 'Throw Downs' }, expected: 'bodyweight' },
  // "Push down" and "pull down" are loaded cable work and must not be swept up with "throw down".
  { label: 'Tricep Pushdown stays strength', input: { name: 'Tricep Pushdown', equipment: 'cable' }, expected: 'strength' },
  { label: 'Rope Push Down stays strength', input: { name: 'Rope Push Down', equipment: 'cable' }, expected: 'strength' },
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
