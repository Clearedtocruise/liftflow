import assert from 'node:assert/strict';
import test from 'node:test';

import { enrichParsedCommand, parseVoiceCommandLocal } from './parseVoiceCommand';

test('parses "95 pounds at 12 reps" against the active exercise', () => {
  const parsed = parseVoiceCommandLocal('95 pounds at 12 reps.', {
    activeExerciseName: 'Barbell Curl',
    preferredWeightUnit: 'lb',
  });
  assert.ok(parsed);
  assert.equal(parsed?.intent, 'log_set');
  assert.equal(parsed?.weight, 95);
  assert.equal(parsed?.reps, 12);
  const enriched = enrichParsedCommand(parsed!, {
    activeExerciseName: 'Barbell Curl',
    preferredWeightUnit: 'lb',
  });
  assert.equal(enriched.exercise, 'Barbell Curl');
});

test('parses "95 at 12" shorthand', () => {
  const parsed = parseVoiceCommandLocal('95 at 12', {
    activeExerciseName: 'Bench Press',
  });
  assert.ok(parsed);
  assert.equal(parsed?.weight, 95);
  assert.equal(parsed?.reps, 12);
});

test('still parses "95 pounds for 12 reps"', () => {
  const parsed = parseVoiceCommandLocal('95 pounds for 12 reps', {
    activeExerciseName: 'Bench Press',
  });
  assert.ok(parsed);
  assert.equal(parsed?.weight, 95);
  assert.equal(parsed?.reps, 12);
});
