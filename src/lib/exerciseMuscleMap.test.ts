import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveExerciseMuscles } from './exerciseMuscleMap';

test('DB Kickback resolves to triceps, never Full Body', () => {
  assert.deepEqual(resolveExerciseMuscles('DB Kickback').primary, ['triceps']);
  assert.deepEqual(resolveExerciseMuscles('DB KICKBACK').primary, ['triceps']);
  assert.deepEqual(resolveExerciseMuscles('Dumbbell Kickback').primary, ['triceps']);
  assert.deepEqual(resolveExerciseMuscles('Exercise', ['full_body'], 'db-kickback').primary, ['triceps']);
  // Empty / full-body tags must not win over the kickback name.
  assert.deepEqual(resolveExerciseMuscles('DB Kickback', ['full_body']).primary, ['triceps']);
  assert.deepEqual(resolveExerciseMuscles('DB Kickback', []).primary, ['triceps']);
  assert.notEqual(resolveExerciseMuscles('DB Kickback').primary[0], 'full-body');
});

test('glute cable kickback stays glutes', () => {
  assert.deepEqual(resolveExerciseMuscles('Cable Kickback').primary, ['glutes']);
  assert.deepEqual(resolveExerciseMuscles('Glute Kickback').primary, ['glutes']);
});

test('plural exercise names resolve to their real muscles, not Full Body', () => {
  // Reported bug: imported plans use plural names ("Curls", "Pullups", "Barbell Rows",
  // "DB Rows") and every one rendered as Full Body because `\bcurl\b` etc. never match the
  // plural "s" form.
  assert.deepEqual(resolveExerciseMuscles('Curls').primary, ['biceps']);
  assert.deepEqual(resolveExerciseMuscles('Pullups').primary, ['lats']);
  assert.deepEqual(resolveExerciseMuscles('Barbell Rows').primary, ['lats']);
  assert.deepEqual(resolveExerciseMuscles('DB Rows').primary, ['lats']);
  assert.deepEqual(resolveExerciseMuscles('Squats').primary, ['quads', 'glutes']);
  assert.deepEqual(resolveExerciseMuscles('Push-ups').primary, ['chest']);
  assert.deepEqual(resolveExerciseMuscles('Lunges').primary, ['quads', 'glutes']);
  assert.deepEqual(resolveExerciseMuscles('Deadlifts').primary, ['hamstrings', 'glutes']);
  assert.deepEqual(resolveExerciseMuscles('Shoulder Presses').primary, ['shoulders']);
  assert.deepEqual(resolveExerciseMuscles('Planks').primary, ['core']);
  assert.deepEqual(resolveExerciseMuscles('Crunches').primary, ['core']);
  assert.deepEqual(resolveExerciseMuscles('Leg Raises').primary, ['core']);
  assert.deepEqual(resolveExerciseMuscles('Calf Raises').primary, ['calves']);
  assert.deepEqual(resolveExerciseMuscles('Lateral Raises').primary, ['shoulders']);
  assert.deepEqual(resolveExerciseMuscles('Chin-ups').primary, ['lats']);

  for (const name of [
    'Curls',
    'Pullups',
    'Barbell Rows',
    'DB Rows',
    'Squats',
    'Push-ups',
    'Lunges',
    'Deadlifts',
  ]) {
    assert.notEqual(resolveExerciseMuscles(name).primary[0], 'full-body');
  }
});

test('incline and chest presses are chest work, not shoulder presses', () => {
  // "Incline DB Press" has no "bench", so the generic press rule painted the delts red
  // and the triceps blue and never mentioned the chest.
  for (const name of [
    'Incline DB Press',
    'INCLINE DB PRESS',
    'Incline Dumbbell Press',
    'Incline Dumbbell Bench Press',
    'Incline Press',
    'Decline DB Press',
    'Chest Press',
    'Floor Press',
  ]) {
    const profile = resolveExerciseMuscles(name);
    assert.deepEqual(profile.primary, ['chest'], name);
    assert.ok(profile.secondary.includes('triceps'), name);
    assert.ok(!profile.primary.includes('shoulders'), name);
  }

  // The same label shows up when the stored tags are the generic press pair,
  // including names that do not have their own catalog slug.
  const tagged = resolveExerciseMuscles('Incline DB Press', ['shoulders', 'triceps']);
  assert.deepEqual(tagged.primary, ['chest']);
  assert.ok(!tagged.primary.includes('shoulders'));
  const highIncline = resolveExerciseMuscles('High Incline DB Press', ['shoulders', 'triceps']);
  assert.deepEqual(highIncline.primary, ['chest']);

  const bySlug = resolveExerciseMuscles('Press', ['shoulders'], 'incline-dumbbell-press');
  assert.deepEqual(bySlug.primary, ['chest']);

  // Overhead and shoulder presses stay shoulders. A bare "press" is still that fallback.
  assert.deepEqual(resolveExerciseMuscles('Shoulder Presses').primary, ['shoulders']);
  assert.deepEqual(resolveExerciseMuscles('Dumbbell Shoulder Press').primary, ['front-delts', 'side-delts']);
  assert.ok(!resolveExerciseMuscles('Overhead Press').primary.includes('chest'));
  assert.deepEqual(resolveExerciseMuscles('Arnold Press').primary, ['shoulders']);
  assert.deepEqual(resolveExerciseMuscles('DB Press').primary, ['shoulders']);
  assert.deepEqual(resolveExerciseMuscles('Leg Press').primary, ['quads', 'glutes']);
});
