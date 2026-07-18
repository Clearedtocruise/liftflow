import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

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

function VoiceLevelMeter({
  isListening,
  interimTranscript,
}: {
  isListening: boolean;
  interimTranscript: string;
}) {
  const level = useRef(new Animated.Value(0.12)).current;

  useEffect(() => {
    if (!isListening) {
      Animated.timing(level, { toValue: 0.12, duration: 180, useNativeDriver: false }).start();
      return;
    }

    const activity = Math.min(1, Math.max(0.25, interimTranscript.trim().length / 28));
    Animated.timing(level, {
      toValue: activity,
      duration: 120,
      useNativeDriver: false,
    }).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(level, { toValue: Math.min(1, activity + 0.2), duration: 280, useNativeDriver: false }),
        Animated.timing(level, { toValue: Math.max(0.2, activity - 0.1), duration: 280, useNativeDriver: false }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [isListening, interimTranscript, level]);

  const width = level.interpolate({
    inputRange: [0, 1],
    outputRange: ['8%', '100%'],
  });

  return (
    <View style={styles.meterWrap} accessibilityLabel="Microphone level meter">
      <AppText variant="caption" color="textTertiary">
        Mic level
      </AppText>
      <View style={styles.meterTrack}>
        <Animated.View style={[styles.meterFill, { width }]} />
      </View>
      <AppText variant="footnote" color="textSecondary">
        {isListening ? 'Listening — speak clearly near the phone' : 'Tap and speak to activate the meter'}
      </AppText>
    </View>
  );
}

export default function VoiceTestScreen() {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<VoiceTestResult[]>([]);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [listenStartedAt, setListenStartedAt] = useState<number | null>(null);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const phrase = VOICE_TEST_PHRASES[index]!;
  const phraseRef = useRef(phrase);
  phraseRef.current = phrase;

  const handleFinal = useCallback((text: string) => {
    setLastTranscript(text);
    if (listenStartedAt != null) {
      setLastLatencyMs(Date.now() - listenStartedAt);
      setListenStartedAt(null);
    }
    const scored = scoreVoiceTestTranscript(phraseRef.current, text);
    setResults((prev) => [...prev.filter((r) => r.phraseId !== scored.phraseId), scored]);
    void voiceCoachingService.speakLine(
      scored.passed ? 'Got it.' : 'Not quite. Try again or go next.',
    );
  }, [listenStartedAt]);

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
          say them — meter, practice, diagnostics, and calibration in one place.
        </AppText>

        {!isAvailable ? (
          <AppText variant="body" color="error">
            Voice recognition needs a development build (not Expo Go).
          </AppText>
        ) : null}

        <VoiceLevelMeter isListening={isListening} interimTranscript={interimTranscript} />

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
              Practice · Step {index + 1} of {VOICE_TEST_PHRASES.length}
            </AppText>
            <AppText variant="label" color="accent">
              {phrase.prompt}
            </AppText>
            <AppText variant="headline">“{phrase.say}”</AppText>

            <PrimaryButton
              label={isListening ? 'Listening… tap to stop' : 'Tap and speak'}
              onPress={() => {
                if (isListening) {
                  stopListening();
                  return;
                }
                setListenStartedAt(Date.now());
                void startListening();
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

        <View style={styles.diagnostics}>
          <AppText variant="label" color="textSecondary">
            Diagnostics
          </AppText>
          <AppText variant="footnote" color="textSecondary">
            Availability: {isAvailable ? 'ready' : 'unavailable (needs a development build)'}
          </AppText>
          <AppText variant="footnote" color="textSecondary">
            Listening: {isListening ? 'yes' : 'no'}
          </AppText>
          <AppText variant="footnote" color="textSecondary">
            Latency: {lastLatencyMs != null ? `${lastLatencyMs} ms (tap → final transcript)` : '—'}
          </AppText>
          <AppText variant="footnote" color="textSecondary">
            Permission: mic + speech recognition required on device
          </AppText>
          {error ? (
            <AppText variant="footnote" color="error">
              Last error: {error}
            </AppText>
          ) : null}
        </View>

        <View style={styles.diagnostics}>
          <AppText variant="label" color="textSecondary">
            Calibration
          </AppText>
          <AppText variant="footnote" color="textSecondary">
            Phrases passed: {passedCount}/{VOICE_TEST_PHRASES.length}
          </AppText>
          {VOICE_TEST_PHRASES.map((item) => {
            const result = results.find((r) => r.phraseId === item.id);
            return (
              <AppText
                key={item.id}
                variant="footnote"
                color={result?.passed ? 'success' : result ? 'error' : 'textTertiary'}>
                {result?.passed ? '✓' : result ? '✗' : '○'} {item.say}
              </AppText>
            );
          })}
        </View>
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
  diagnostics: {
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    backgroundColor: LiftFlowColors.surface,
  },
  meterWrap: {
    gap: Spacing.xs,
  },
  meterTrack: {
    height: 10,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.border,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.accent,
  },
});
