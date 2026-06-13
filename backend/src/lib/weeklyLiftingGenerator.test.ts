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

const schedule = buildWeeklySchedule('push_pull_legs', 6);
assert.equal(schedule.filter((day) => !day.isRest && day.sessionKind === 'strength').length, 6);
assert.equal(schedule.some((day) => day.sessionKind === 'cardio'), false);

console.log('weeklyLiftingGenerator.test.ts — all assertions passed');
