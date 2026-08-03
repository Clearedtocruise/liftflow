import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveMovementFamily, type MovementFamilyInput } from './exerciseMovementFamily';

function family(name: string, extra: Partial<MovementFamilyInput> = {}) {
  return resolveMovementFamily({ name, ...extra });
}

test('kickbacks are separated by the muscle they actually train', () => {
  // The catalog tags both as horizontal_press, which is what produced bench-press loads on a
  // triceps kickback.
  assert.equal(family('DB Kickback'), 'triceps_isolation');
  assert.equal(family('Cable Triceps Kickback'), 'triceps_isolation');
  assert.equal(family('Glute Kickback'), 'glute_isolation');
  assert.equal(family('Donkey Kick'), 'glute_isolation');
  // Migration 034 settled this one: a bare "cable kickback" is the glute version, and the triceps
  // variant is named for the triceps.
  assert.equal(family('Cable Kickback'), 'glute_isolation');
});

test('a curl is only a biceps curl when it is one', () => {
  assert.equal(family('Dumbbell Curl'), 'biceps_isolation');
  assert.equal(family('Hammer Curl'), 'biceps_isolation');
  // Coaching a hamstring eccentric as an arm exercise would be actively wrong.
  assert.equal(family('Nordic Curl'), 'hamstring_isolation');
  assert.equal(family('Leg Curl'), 'hamstring_isolation');
  assert.equal(family('Hammer Wrist Curl'), null);
});

test('presses and pulls are split by direction', () => {
  assert.equal(family('Bench Press'), 'horizontal_press');
  assert.equal(family('Push-Up'), 'horizontal_press');
  assert.equal(family('Overhead Press'), 'vertical_press');
  assert.equal(family('Barbell Row'), 'horizontal_pull');
  assert.equal(family('Lat Pulldown'), 'vertical_pull');
  assert.equal(family('Wide Pull-Up'), 'vertical_pull');
});

test('shoulder and chest isolation are not mistaken for pressing', () => {
  assert.equal(family('Lateral Raise'), 'lateral_raise');
  assert.equal(family('Front Raise'), 'lateral_raise');
  assert.equal(family('Face Pull'), 'rear_delt');
  assert.equal(family('Reverse Fly'), 'rear_delt');
  assert.equal(family('Pec Deck'), 'chest_isolation');
});

test('core work is split by the demand it places on the trunk', () => {
  assert.equal(family('Plank'), 'core_anti_extension');
  assert.equal(family('Side Plank'), 'core_anti_lateral');
  assert.equal(family('Dumbbell Side Bend'), 'core_anti_lateral');
  assert.equal(family('Pallof Press'), 'core_anti_lateral');
  assert.equal(family('Russian Twist'), 'core_rotation');
  assert.equal(family('Weighted Sit-Up'), 'core_flexion');
});

test('lower body patterns are distinguished from each other', () => {
  assert.equal(family('Back Squat'), 'squat_pattern');
  assert.equal(family('Goblet Squat'), 'squat_pattern');
  assert.equal(family('Walking Lunge'), 'lunge_pattern');
  assert.equal(family('Bulgarian Split Squat'), 'lunge_pattern');
  assert.equal(family('Romanian Deadlift'), 'hinge_pattern');
  assert.equal(family('Good Morning'), 'hinge_pattern');
  assert.equal(family('Leg Extension'), 'quad_isolation');
  assert.equal(family('Standing Calf Raise'), 'calf_isolation');
});

test('carries and cardio are recognised without swallowing lifts', () => {
  assert.equal(family('Farmer Carry'), 'carry');
  assert.equal(family('Yoke Walk'), 'carry');
  assert.equal(family('Suitcase Carry'), 'core_anti_lateral');
  assert.equal(family('Running'), 'cardio');
  assert.equal(family('Assault Bike Sprint'), 'cardio');
});

test('an unrecognised movement stays general rather than being guessed', () => {
  // The imported categories are unreliable: Burpee and Barbell Complex are stored as `carry`,
  // Neck Flexion as `squat`, Sled Push as `hinge`. A wrong family gives confidently wrong
  // coaching, so no category fallback is applied.
  assert.equal(family('Burpee', { category: 'carry' }), null);
  assert.equal(family('Barbell Complex', { category: 'carry' }), null);
  assert.equal(family('Neck Flexion', { category: 'squat' }), null);
  assert.equal(family('Battle Rope Grip Wave', { category: 'core' }), null);
});

test('a single named muscle can identify isolation work when the name does not', () => {
  assert.equal(family('Ab Machine', { muscleGroups: ['core'] }), 'core_anti_extension');
  assert.equal(family('Preacher Machine', { muscleGroups: ['biceps'] }), 'biceps_isolation');
  // A compound lift names several muscles and must not be coached as isolation.
  assert.equal(family('Unknown Machine', { muscleGroups: ['chest', 'triceps', 'shoulders'] }), null);
});

test('slug is used when a name is unavailable', () => {
  assert.equal(resolveMovementFamily({ slug: 'side-plank' }), 'core_anti_lateral');
  assert.equal(resolveMovementFamily({ slug: 'lat-pulldown' }), 'vertical_pull');
  assert.equal(resolveMovementFamily({}), null);
});
