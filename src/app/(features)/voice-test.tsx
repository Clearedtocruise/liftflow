import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';
import { speakWithMusicDuck } from '@/lib/iosAudioSession';
import {
    markVoiceLoggingTestPassed,
    scoreVoiceTestTranscript,
    VOICE_TEST_PHRASES,
    type VoiceTestResult,
} from '@/lib/voice/voiceLoggingTest';
import { voiceCoachingService } from '@/services/voiceCoachingService';

export default function VoiceTestScreen() {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<VoiceTestResult[]>([]);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const phrase = VOICE_TEST_PHRASES[index]!;
  const phraseRef = useRef(phrase);
  phraseRef.current = phrase;

  const handleFinal = useCallback((text: string) => {
    setLastTranscript(text);
    const scored = scoreVoiceTestTranscript(phraseRef.current, text);
    setResults((prev) => [...prev.filter((r) => r.phraseId !== scored.phraseId), scored]);
    void voiceCoachingService.speakLine(
      scored.passed ? 'Got it.' : 'Not quite. Try again or go next.',
    );
  }, []);

  const { isListening, startListening, stopListening, error, isAvailable, interimTranscript } =
    useVoiceRecognition({
      onFinalTranscript: handleFinal,
      inputMode: 'push_to_talk',
    });

  useEffect(() => {
    void voiceCoachingService.speakLine(`Say: ${phrase.say}`);
  }, [phrase.id, phrase.say]);

  const passedCount = results.filter((r) => r.passed).length;
  const currentResult = results.find((r) => r.phraseId === phrase.id);

  useEffect(() => {
    const allPassed = VOICE_TEST_PHRASES.every((p) =>
      results.some((r) => r.phraseId === p.id && r.passed),
    );
    if (allPassed || passedCount >= 2) {
      void markVoiceLoggingTestPassed().then(() => {
        setDone(true);
        void voiceCoachingService.speakLine('Voice logging looks good. You are ready.');
      });
    }
  }, [passedCount, results]);

  return (
    <ScreenContainer scroll>
      <View style={styles.wrap}>
        <AppText variant="headline">Voice logging test</AppText>
        <AppText variant="body" color="textSecondary">
          Speak clearly near the phone. This checks that ONE MORE hears weights and reps the way you
          say them.
        </AppText>

        {!isAvailable ? (
          <AppText variant="body" color="error">
            Voice recognition needs a development build (not Expo Go).
          </AppText>
        ) : null}

        {done ? (
          <View style={styles.card}>
            <AppText variant="bodyBold" color="accent">
              Ready for workouts
            </AppText>
            <AppText variant="footnote" color="textSecondary">
              Passed {passedCount} of {VOICE_TEST_PHRASES.length} checks.
            </AppText>
            <PrimaryButton label="Done" onPress={() => router.back()} />
          </View>
        ) : (
          <View style={styles.card}>
            <AppText variant="caption" color="textTertiary">
              Step {index + 1} of {VOICE_TEST_PHRASES.length}
            </AppText>
            <AppText variant="label" color="accent">
              {phrase.prompt}
            </AppText>
            <AppText variant="headline">“{phrase.say}”</AppText>

            <PrimaryButton
              label={isListening ? 'Listening… tap to stop' : 'Tap and speak'}
              onPress={() => {
                if (isListening) stopListening();
                else void startListening();
              }}
              disabled={!isAvailable}
            />

            {interimTranscript || lastTranscript ? (
              <AppText variant="footnote" color="textSecondary">
                Heard: “{interimTranscript || lastTranscript}”
              </AppText>
            ) : null}
            {currentResult ? (
              <AppText variant="footnote" color={currentResult.passed ? 'success' : 'error'}>
                {currentResult.detail}
              </AppText>
            ) : null}
            {error ? (
              <AppText variant="caption" color="error">
                {error}
              </AppText>
            ) : null}

            <View style={styles.row}>
              <Pressable
                onPress={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0}
                style={styles.link}>
                <AppText variant="caption" color={index === 0 ? 'textTertiary' : 'accent'}>
                  Back
                </AppText>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (index >= VOICE_TEST_PHRASES.length - 1) {
                    void markVoiceLoggingTestPassed().then(() => setDone(true));
                    return;
                  }
                  setLastTranscript(null);
                  setIndex((i) => i + 1);
                }}
                style={styles.link}>
                <AppText variant="caption" color="accent">
                  {index >= VOICE_TEST_PHRASES.length - 1 ? 'Finish' : 'Next'}
                </AppText>
              </Pressable>
            </View>
          </View>
        )}

        <Pressable
          onPress={() => {
            speakWithMusicDuck('This is how ONE MORE will speak during workouts.');
            void voiceCoachingService.speakLine(
              'When online, short coach cues use a clearer voice.',
            );
          }}>
          <AppText variant="caption" color="accent" align="center">
            Preview spoken voice
          </AppText>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.lg,
    padding: Spacing.lg,
  },
  card: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: LiftFlowColors.accent,
    backgroundColor: LiftFlowColors.primaryGlow,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  link: {
    paddingVertical: Spacing.sm,
  },
});
