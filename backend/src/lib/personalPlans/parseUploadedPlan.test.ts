import assert from 'node:assert/strict';
import { test } from 'node:test';

import { normalizeParsedPersonalPlan } from './parseUploadedPlan.js';

test('uploaded workout JSON keeps a 5-set pull-up instead of dropping the day', () => {
  const plan = normalizeParsedPersonalPlan('workout', 'cut.pdf', {
    title: 'Week 1',
    workouts: [
      {
        dayIndex: 0,
        label: 'Back',
        muscleGroups: ['back'],
        exercises: [
          { name: 'Pull-Up', sets: '5', reps: '5', restSeconds: 180 },
          { name: 'Barbell Row', sets: 5, reps: '6' },
        ],
      },
    ],
  });
  assert.ok(plan);
  assert.equal(plan?.workouts?.[0]?.exercises[0]?.name, 'Pull-Up');
  assert.equal(plan?.workouts?.[0]?.exercises[0]?.sets, 5);
});

test('uploaded nutrition JSON requires a meal or a calorie target', () => {
  assert.equal(normalizeParsedPersonalPlan('nutrition', 'meals.pdf', { title: 'Empty' }), null);
  const plan = normalizeParsedPersonalPlan('nutrition', 'meals.pdf', {
    nutritionGoals: { calories: 2175, proteinG: 210 },
  });
  assert.equal(plan?.nutritionGoals?.calories, 2175);
});
