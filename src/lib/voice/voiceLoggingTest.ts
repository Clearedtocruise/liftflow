import AsyncStorage from '@react-native-async-storage/async-storage';

import { parseVoiceCommandLocal } from '@/lib/voice/parseVoiceCommand';

export const VOICE_TEST_PASSED_KEY = 'voice_logging_test_passed_v1';
export const VOICE_TEST_SKIPPED_KEY = 'voice_logging_test_skipped_v1';

export type VoiceTestPhrase = {
  id: string;
  prompt: string;
  /** Exact phrase we ask the user to say */
  say: string;
  expectWeightLb?: number;
  expectReps?: number;
};

export const VOICE_TEST_PHRASES: VoiceTestPhrase[] = [
  {
    id: 'weight-reps',
    prompt: 'Say a full set log',
    say: 'one thirty five for eight',
    expectWeightLb: 135,
    expectReps: 8,
  },
  {
    id: 'reps-only',
    prompt: 'Say reps only',
    say: 'ten reps',
    expectReps: 10,
  },
  {
    id: 'log-set',
    prompt: 'Say the log command',
    say: 'log set',
  },
];

export type VoiceTestResult = {
  phraseId: string;
  transcript: string;
  passed: boolean;
  detail: string;
  parsedWeight?: number;
  parsedReps?: number;
};

export function scoreVoiceTestTranscript(
  phrase: VoiceTestPhrase,
  transcript: string,
): VoiceTestResult {
  const parsed = parseVoiceCommandLocal(transcript, {});
  const weight = parsed?.weight != null ? Math.round(parsed.weight) : undefined;
  const reps = parsed?.reps != null ? Math.round(parsed.reps) : undefined;

  if (phrase.id === 'log-set') {
    const intentOk =
      parsed?.intent === 'log_set' ||
      parsed?.intent === 'completed_set' ||
      /\blog\s+set\b/i.test(transcript);
    return {
      phraseId: phrase.id,
      transcript,
      passed: intentOk,
      detail: intentOk ? 'Heard log set' : 'Did not hear “log set”',
      parsedWeight: weight,
      parsedReps: reps,
    };
  }

  const weightOk =
    phrase.expectWeightLb == null ||
    (weight != null && Math.abs(weight - phrase.expectWeightLb) <= 1);
  const repsOk = phrase.expectReps == null || reps === phrase.expectReps;
  const passed = weightOk && repsOk;

  const parts: string[] = [];
  if (phrase.expectWeightLb != null) {
    parts.push(
      weightOk
        ? `Weight ${weight} lb ✓`
        : `Expected ${phrase.expectWeightLb} lb, got ${weight ?? '—'}`,
    );
  }
  if (phrase.expectReps != null) {
    parts.push(repsOk ? `Reps ${reps} ✓` : `Expected ${phrase.expectReps} reps, got ${reps ?? '—'}`);
  }

  return {
    phraseId: phrase.id,
    transcript,
    passed,
    detail: parts.join(' · ') || (passed ? 'Matched' : 'No match'),
    parsedWeight: weight,
    parsedReps: reps,
  };
}

export async function hasPassedVoiceLoggingTest(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(VOICE_TEST_PASSED_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function hasSkippedVoiceLoggingTest(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(VOICE_TEST_SKIPPED_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function markVoiceLoggingTestPassed(): Promise<void> {
  await AsyncStorage.multiSet([
    [VOICE_TEST_PASSED_KEY, '1'],
    [VOICE_TEST_SKIPPED_KEY, '1'],
  ]);
}

export async function markVoiceLoggingTestSkipped(): Promise<void> {
  await AsyncStorage.setItem(VOICE_TEST_SKIPPED_KEY, '1');
}
