import assert from 'node:assert/strict';
import test from 'node:test';

import { inferProgramType } from './programSelection.js';

test('only the top goal decides the split', () => {
  // Listing "strength" as a lesser priority used to hand the athlete the powerlifting week —
  // Squat, Bench and Deadlift days — in place of the split they were running.
  assert.equal(
    inferProgramType({ primaryGoal: 'general_fitness', fitnessGoals: ['general_fitness', 'strength'], daysPerWeek: 4 }),
    'push_pull_legs',
  );
  assert.equal(
    inferProgramType({ primaryGoal: 'strength', fitnessGoals: ['strength'], daysPerWeek: 4 }),
    'strength',
  );
});

test('four or more days a week gives a push/pull/legs week', () => {
  // Every branch used to fall through to a body part split, so this was unreachable.
  for (const days of [4, 5, 6, 7]) {
    assert.equal(
      inferProgramType({ primaryGoal: 'general_fitness', daysPerWeek: days }),
      'push_pull_legs',
      `${days} days a week`,
    );
  }
});

test('the remaining goals keep their own splits', () => {
  assert.equal(inferProgramType({ primaryGoal: 'muscle_gain', daysPerWeek: 5 }), 'body_part_split');
  assert.equal(inferProgramType({ primaryGoal: 'hypertrophy', daysPerWeek: 5 }), 'body_part_split');
  assert.equal(inferProgramType({ primaryGoal: 'fat_loss', daysPerWeek: 4 }), 'upper_lower');
  // Three days or fewer cannot support a split week.
  assert.equal(inferProgramType({ primaryGoal: 'general_fitness', daysPerWeek: 3 }), 'body_part_split');
});
