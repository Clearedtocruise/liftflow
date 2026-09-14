import assert from 'node:assert/strict';
import test from 'node:test';

import { parseSpokenDurationSeconds } from './holdDuration';
import { parseVoiceCommandLocal } from './parseVoiceCommand';
import { FAST_PATH_CONFIDENCE } from './voicePlausibility';

test('seconds are heard as digits or as words', () => {
  assert.equal(parseSpokenDurationSeconds('60 seconds'), 60);
  assert.equal(parseSpokenDurationSeconds('45 sec'), 45);
  assert.equal(parseSpokenDurationSeconds('30s'), 30);
  assert.equal(parseSpokenDurationSeconds('sixty seconds'), 60);
  assert.equal(parseSpokenDurationSeconds('ninety seconds'), 90);
});

test('minutes become seconds', () => {
  assert.equal(parseSpokenDurationSeconds('a minute'), 60);
  assert.equal(parseSpokenDurationSeconds('one minute'), 60);
  assert.equal(parseSpokenDurationSeconds('2 minutes'), 120);
  assert.equal(parseSpokenDurationSeconds('2 minutes 30 seconds'), 150);
  assert.equal(parseSpokenDurationSeconds('a minute and a half'), 90);
  assert.equal(parseSpokenDurationSeconds('half a minute'), 30);
  assert.equal(parseSpokenDurationSeconds('1:30'), 90);
});

test('a duration needs a unit, so reps and load are never read as time', () => {
  assert.equal(parseSpokenDurationSeconds('8'), undefined);
  assert.equal(parseSpokenDurationSeconds('225 for 8'), undefined);
  assert.equal(parseSpokenDurationSeconds(''), undefined);
  assert.equal(parseSpokenDurationSeconds(null), undefined);
});

test('a hold said out loud logs its time without needing confirmation', () => {
  for (const said of [
    'plank for 60 seconds',
    'plank 60 seconds',
    'plank for a minute',
    'side plank 45 seconds',
  ]) {
    const parsed = parseVoiceCommandLocal(said, { activeExerciseName: 'Plank' });
    assert.ok(parsed, `no parse for "${said}"`);
    assert.equal(parsed.intent, 'log_set', said);
    assert.ok(parsed.durationSeconds, `no duration for "${said}"`);
    assert.ok(
      (parsed.confidence ?? 0) >= FAST_PATH_CONFIDENCE,
      `"${said}" would be sent away for confirmation`,
    );
  }
});

test('the time held is what gets logged', () => {
  assert.equal(
    parseVoiceCommandLocal('plank for 60 seconds', {})?.durationSeconds,
    60,
  );
  assert.equal(parseVoiceCommandLocal('dead hang 45 seconds', {})?.durationSeconds, 45);
  assert.equal(parseVoiceCommandLocal('wall sit for two minutes', {})?.durationSeconds, 120);
});

test('a hold counts as one set, since the time carries the effort', () => {
  assert.equal(parseVoiceCommandLocal('plank for 60 seconds', {})?.reps, 1);
});

test('the exercise is taken from the words, not from what is on screen', () => {
  const parsed = parseVoiceCommandLocal('side plank 45 seconds', { activeExerciseName: 'Plank' });
  assert.match(parsed?.exercise ?? '', /side plank/i);
});

test('a hold with no exercise named falls back to the card on screen', () => {
  const parsed = parseVoiceCommandLocal('held for 60 seconds', { activeExerciseName: 'Plank' });
  assert.equal(parsed?.durationSeconds, 60);
  assert.match(parsed?.exercise ?? '', /plank/i);
});

test('a weighted set is still read as weight and reps', () => {
  const parsed = parseVoiceCommandLocal('bench press 225 for 8 reps', {});
  assert.equal(parsed?.durationSeconds, undefined);
  assert.equal(parsed?.weight, 225);
  assert.equal(parsed?.reps, 8);
});

test('a mishearing that makes an absurd hold is sent for confirmation', () => {
  const parsed = parseVoiceCommandLocal('plank for 4000 seconds', {});
  assert.equal(parsed?.implausible, true);
  assert.ok((parsed?.confidence ?? 1) < FAST_PATH_CONFIDENCE);
});
