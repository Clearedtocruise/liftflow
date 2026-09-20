/**
 * A spoken weight has to survive the parse with its load intact.
 *
 * The hold patterns run ahead of the set patterns so "plank for 60 seconds" is never read as a
 * weight. That ordering used to swallow the plural lifters speak in — "press the 50s for 10" read
 * as a fifty-second hold, which logs one rep carrying nothing and showed up as "— lb × 1".
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { parseVoiceCommandLocal } from './parseVoiceCommand';

const onBench = { activeExerciseName: 'Bench Press' };

function logged(transcript: string, context = onBench) {
  const parsed = parseVoiceCommandLocal(transcript, context);
  assert.ok(parsed, `"${transcript}" did not parse at all`);
  assert.equal(parsed.intent, 'log_set', `"${transcript}" was not heard as a set`);
  return parsed;
}

test('a weight named in the plural is a load, not a length of time', () => {
  const parsed = logged('incline dumbbell press 50s for 10');
  assert.equal(parsed.weight, 50);
  assert.equal(parsed.reps, 10);
  assert.equal(parsed.durationSeconds, undefined);
});

test('the article lifters actually use does not change the reading', () => {
  const parsed = logged('dumbbell press the 50s for 10');
  assert.equal(parsed.weight, 50);
  assert.equal(parsed.reps, 10);
});

test('a plural weight says which number is the load without a unit', () => {
  const parsed = logged('curl 30s 12');
  assert.equal(parsed.weight, 30);
  assert.equal(parsed.reps, 12);
  assert.notEqual(parsed.ambiguousOrder, true);
});

test('the shorthand said with a bar in hand needs no exercise and no "reps"', () => {
  const parsed = logged('225 for 8');
  assert.equal(parsed.weight, 225);
  assert.equal(parsed.reps, 8);
  assert.equal(parsed.durationSeconds, undefined);
});

test('reps counted off with a word other than "for"', () => {
  for (const phrase of ['bench 225 times 8', 'bench 225 by 8', 'bench 225 x 8']) {
    const parsed = logged(phrase);
    assert.equal(parsed.weight, 225, phrase);
    assert.equal(parsed.reps, 8, phrase);
  }
});

test('a hold is still a hold', () => {
  for (const phrase of ['plank for 60 seconds', 'plank 60s', 'dead hang a minute', 'plank 1:30']) {
    const parsed = logged(phrase, { activeExerciseName: 'Plank' });
    assert.ok(parsed.durationSeconds, `"${phrase}" lost its duration`);
  }
});

test('a spelled-out unit stays a duration whatever follows it', () => {
  // Only the bare letter is ambiguous, so this must not be dragged over to the weight reading.
  const parsed = logged('plank 45 seconds each side', { activeExerciseName: 'Plank' });
  assert.equal(parsed.durationSeconds, 45);
});

test('an ordinary weighted set never comes back carrying a duration', () => {
  const phrases = [
    'bench press 225 for 8',
    'bench press 225 pounds for 8 reps',
    'barbell row 135 for 12',
    'squat 315 for 5',
    'overhead press 95 for 8 reps',
    'lat pulldown 120 for 10',
  ];
  for (const phrase of phrases) {
    const parsed = logged(phrase);
    assert.equal(parsed.durationSeconds, undefined, `"${phrase}" was read as a hold`);
    assert.ok((parsed.weight ?? 0) > 0, `"${phrase}" lost its weight`);
  }
});
