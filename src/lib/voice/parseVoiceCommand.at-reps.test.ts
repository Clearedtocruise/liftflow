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

test('parses a set the lifter opened by saying "log"', () => {
  const parsed = parseVoiceCommandLocal('Log 135 at 10.', {
    activeExerciseName: 'Close Grip Bench',
  });
  assert.ok(parsed, 'the leading verb must not leave the set unparsed');
  assert.equal(parsed?.intent, 'log_set');
  assert.equal(parsed?.weight, 135);
  assert.equal(parsed?.reps, 10);
  assert.equal(enrichParsedCommand(parsed!, { activeExerciseName: 'Close Grip Bench' }).exercise, 'Close Grip Bench');
});

test('parses the other ways a lifter asks for a set to be written down', () => {
  for (const spoken of ['logged 225 for 8', 'record 225 for 8', 'put me down for 225 for 8', 'log it as 225 for 8']) {
    const parsed = parseVoiceCommandLocal(spoken, { activeExerciseName: 'Bench Press' });
    assert.ok(parsed, `${spoken} should parse`);
    assert.equal(parsed?.weight, 225, spoken);
    assert.equal(parsed?.reps, 8, spoken);
  }
});

test('a lift whose name starts with a logging word is still an exercise', () => {
  const parsed = parseVoiceCommandLocal('log press 185 for 5', { activeExerciseName: 'Log Press' });
  assert.ok(parsed);
  assert.equal(parsed?.exercise, 'log press');
  assert.equal(parsed?.weight, 185);
  assert.equal(parsed?.reps, 5);
});

test('still parses "95 pounds for 12 reps"', () => {
  const parsed = parseVoiceCommandLocal('95 pounds for 12 reps', {
    activeExerciseName: 'Bench Press',
  });
  assert.ok(parsed);
  assert.equal(parsed?.weight, 95);
  assert.equal(parsed?.reps, 12);
});
