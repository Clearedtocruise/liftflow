import assert from 'node:assert/strict';

import { normalizeSpokenNumbers } from './normalizeSpokenNumbers';
import { parseVoiceCommandLocal } from './parseVoiceCommand';
import { scoreVoiceTestTranscript, VOICE_TEST_PHRASES } from './voiceLoggingTest';

function run() {
  assert.equal(normalizeSpokenNumbers('one thirty five for eight'), '135 for 8');
  assert.equal(normalizeSpokenNumbers('one hundred thirty five'), '135');
  assert.equal(normalizeSpokenNumbers('forty five'), '45');

  const parsed = parseVoiceCommandLocal('one thirty five for eight', {});
  assert.equal(parsed?.weight, 135);
  assert.equal(parsed?.reps, 8);

  const phrase = VOICE_TEST_PHRASES[0]!;
  const scored = scoreVoiceTestTranscript(phrase, 'one thirty five for eight');
  assert.equal(scored.passed, true);

  const repsOnly = scoreVoiceTestTranscript(VOICE_TEST_PHRASES[1]!, 'ten reps');
  assert.equal(repsOnly.passed, true);

  console.log('voiceLoggingAccuracy.test.ts — PASS');
}

run();
