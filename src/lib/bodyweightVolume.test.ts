import assert from 'node:assert/strict';
import test from 'node:test';

import { bodyweightSetLoadKg, bodyweightShare, setVolumeKg } from './bodyweightVolume';

test('variants match before their base movement', () => {
  assert.equal(bodyweightShare('Decline Push-Up'), 0.7);
  assert.equal(bodyweightShare('Incline Push Ups'), 0.45);
  assert.equal(bodyweightShare('Knee Push-Up'), 0.49);
  assert.equal(bodyweightShare('Push-ups'), 0.64);
  assert.equal(bodyweightShare('Bench Dips'), 0.5);
  assert.equal(bodyweightShare('Parallel Bar Dip'), 0.95);
  assert.equal(bodyweightShare('Pull-Ups'), 1);
  assert.equal(bodyweightShare('Dead Bugs'), 0.2);
  assert.equal(bodyweightShare('Hanging Leg Raises'), 0.32);
});

test('an unlisted movement counts nothing rather than a guess', () => {
  assert.equal(bodyweightShare('Bird Dog'), 0);
  assert.equal(bodyweightShare(''), 0);
  assert.equal(bodyweightSetLoadKg('Bird Dog', 82.78), 0);
});

test('a push-up rep moves 64% of body weight', () => {
  assert.equal(bodyweightSetLoadKg('Push-Up', 82.78), 53);
});

test('added weight rides on top of the body-weight share', () => {
  assert.equal(bodyweightSetLoadKg('Weighted Pull-Up', 80, 10), 90);
});

test('an unknown or impossible body weight adds nothing for the body', () => {
  assert.equal(bodyweightSetLoadKg('Push-Up', null), 0);
  assert.equal(bodyweightSetLoadKg('Push-Up', 402.3), 0);
  assert.equal(bodyweightSetLoadKg('Pull-Up', undefined, 10), 10);
});

test('set volume: bodyweight sets use the share, loaded sets use weight × reps', () => {
  assert.equal(setVolumeKg({ isBodyweight: true, exerciseName: 'Push-Up', reps: 10 }, 82.78), 530);
  assert.equal(setVolumeKg({ isBodyweight: false, exerciseName: 'Bench Press', weightKg: 60, reps: 8 }, 82.78), 480);
  assert.equal(setVolumeKg({ isBodyweight: true, exerciseName: 'Push-Up', reps: 0 }, 82.78), 0);
  assert.equal(setVolumeKg({ isBodyweight: false, exerciseName: 'Plank', reps: null }, 82.78), 0);
});
