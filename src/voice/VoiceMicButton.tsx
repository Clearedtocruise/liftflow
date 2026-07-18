import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import {
    hasPassedVoiceLoggingTest,
    hasSkippedVoiceLoggingTest,
    markVoiceLoggingTestSkipped,
} from '@/lib/voice/voiceLoggingTest';

import { useVoiceWorkout } from './useVoiceWorkout';

type VoiceMicButtonProps = {
  disabled?: boolean;
};

export function VoiceMicButton({ disabled }: VoiceMicButtonProps) {
  const {
    wakePhraseSettingEnabled,
    wakeWordEnabled,
    listeningForWakeWord,
    listeningForCommand,
    transcript,
    startCommandListening,
    error,
  } = useVoiceWorkout();
  const [showTestHint, setShowTestHint] = useState(false);

  useEffect(() => {
    void (async () => {
      const [passed, skipped] = await Promise.all([
        hasPassedVoiceLoggingTest(),
        hasSkippedVoiceLoggingTest(),
      ]);
      setShowTestHint(!passed && !skipped);
    })();
  }, []);

  const showWakeHint =
    wakePhraseSettingEnabled && (listeningForWakeWord || listeningForCommand || wakeWordEnabled);

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={() => void startCommandListening()}
        disabled={disabled}
        style={({ pressed }) => [
          styles.primaryButton,
          listeningForCommand && styles.primaryActive,
          disabled && styles.disabled,
          pressed && !disabled && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={listeningForCommand ? 'Listening for workout command' : 'Voice log'}
        testID="voice-log-button">
        <AppText variant="bodyBold" color="textPrimary" align="center">
          {listeningForCommand ? 'Listening…' : 'Voice Log'}
        </AppText>
      </Pressable>

      {showTestHint ? (
        <View style={styles.hintRow}>
          <Pressable onPress={() => router.push('/(features)/voice-test')} hitSlop={8}>
            <AppText variant="caption" color="accent" align="center">
              Optional: improve accuracy
            </AppText>
          </Pressable>
          <Pressable
            onPress={() => {
              setShowTestHint(false);
              void markVoiceLoggingTestSkipped();
            }}
            hitSlop={8}>
            <AppText variant="caption" color="textTertiary" align="center">
              Dismiss
            </AppText>
          </Pressable>
        </View>
      ) : null}

      {listeningForCommand && transcript ? (
        <AppText variant="footnote" color="textSecondary" align="center" numberOfLines={2}>
          “{transcript}”
        </AppText>
      ) : null}

      {showWakeHint ? (
        <View style={styles.wakeRow}>
          <View style={[styles.dot, wakeWordEnabled ? styles.dotOn : styles.dotOff]} />
          <AppText variant="caption" color="textTertiary" align="center">
            {listeningForWakeWord ? 'Hey OneMore' : 'Wake word on'}
          </AppText>
        </View>
      ) : null}

      {error ? (
        <AppText variant="caption" color="error" align="center">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.xs,
  },
  primaryButton: {
    backgroundColor: LiftFlowColors.backgroundSecondary,
    borderWidth: 1,
    borderColor: LiftFlowColors.accent,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
  },
  primaryActive: {
    backgroundColor: LiftFlowColors.accentGlow,
    borderColor: LiftFlowColors.accent,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.9,
  },
  hintRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  wakeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: Radius.full,
  },
  dotOn: {
    backgroundColor: LiftFlowColors.success,
  },
  dotOff: {
    backgroundColor: LiftFlowColors.textTertiary,
  },
});
