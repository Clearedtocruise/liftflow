import assert from 'node:assert/strict';
import { buildWeeklySchedule } from './programTypes.js';
import {
    buildWeeklyLiftingPlan,
    countLiftingDaysInPattern,
    formatWeeklyPattern,
    getWeeklyLiftingPattern,
    inferWeeklyLiftingSplit,
    patternIncludesNonLiftingReplacement,
} from './weeklyLiftingGenerator.js';

const ppl6 = getWeeklyLiftingPattern('push_pull_legs', 6);
assert.equal(formatWeeklyPattern(ppl6), 'Push · Pull · Legs · Push · Pull · Legs · Rest');
assert.equal(countLiftingDaysInPattern(ppl6), 6);
assert.equal(patternIncludesNonLiftingReplacement(ppl6), false);

const ul6 = getWeeklyLiftingPattern('upper_lower', 6);
assert.equal(formatWeeklyPattern(ul6), 'Upper · Lower · Upper · Lower · Upper · Lower · Rest');
assert.equal(countLiftingDaysInPattern(ul6), 6);

const ppl3 = getWeeklyLiftingPattern('push_pull_legs', 3);
assert.equal(countLiftingDaysInPattern(ppl3), 3);

const bodyPart3 = getWeeklyLiftingPattern('body_part_split', 3);
assert.equal(
  formatWeeklyPattern(bodyPart3),
  'Back, Biceps & Core · Chest, Shoulders & Triceps · Legs & Core · Rest · Rest · Rest · Rest',
);
assert.equal(countLiftingDaysInPattern(bodyPart3), 3);

const bodyPart6 = getWeeklyLiftingPattern('body_part_split', 6);
assert.equal(countLiftingDaysInPattern(bodyPart6), 6);

const hypertrophySplit = inferWeeklyLiftingSplit({
  primaryGoal: 'muscle_gain',
  daysPerWeek: 6,
});
assert.equal(hypertrophySplit, 'push_pull_legs');

const fatLossSplit = inferWeeklyLiftingSplit({
  primaryGoal: 'fat_loss',
  daysPerWeek: 4,
});
assert.equal(fatLossSplit, 'upper_lower');

const plan = buildWeeklyLiftingPlan({
  programType: 'push_pull_legs',
  liftingDaysPerWeek: 6,
  primaryGoal: 'muscle_gain',
});
assert.equal(plan.liftingDayCount, 6);
assert.equal(plan.pattern.length, 7);

const schedule = buildWeeklySchedule('body_part_split', 3);
assert.equal(schedule.filter((day) => !day.isRest).length, 3);
assert.deepEqual(schedule[0]?.muscleGroups, ['back', 'biceps', 'core']);
assert.deepEqual(schedule[1]?.muscleGroups, ['chest', 'shoulders', 'triceps', 'core']);
assert.deepEqual(schedule[2]?.muscleGroups, ['quads', 'hamstrings', 'glutes', 'calves', 'core']);

const pplSchedule = buildWeeklySchedule('push_pull_legs', 6);
assert.equal(pplSchedule.filter((day) => !day.isRest && day.sessionKind === 'strength').length, 6);
assert.equal(pplSchedule.some((day) => day.sessionKind === 'cardio'), false);

const bodyPart7 = getWeeklyLiftingPattern('body_part_split', 7);
assert.equal(countLiftingDaysInPattern(bodyPart7), 7);
assert.equal(formatWeeklyPattern(bodyPart7).includes('Back, Biceps & Core'), true);

const plan7 = buildWeeklyLiftingPlan({
  programType: 'body_part_split',
  liftingDaysPerWeek: 7,
  primaryGoal: 'muscle_gain',
});
assert.equal(plan7.liftingDayCount, 7);

const schedule7 = buildWeeklySchedule('body_part_split', 7);
assert.equal(schedule7.filter((day) => !day.isRest).length, 7);

console.log('weeklyLiftingGenerator.test.ts — all assertions passed');
