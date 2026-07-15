import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { hasPassedVoiceLoggingTest } from '@/lib/voice/voiceLoggingTest';

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
  const [testPassed, setTestPassed] = useState(true);

  useEffect(() => {
    void hasPassedVoiceLoggingTest().then(setTestPassed);
  }, []);

  const handlePress = useCallback(() => {
    if (!testPassed) {
      Alert.alert(
        'Quick voice test',
        'A 30-second check makes voice logging more accurate. Take it now?',
        [
          {
            text: 'Later',
            style: 'cancel',
            onPress: () => void startCommandListening(),
          },
          {
            text: 'Take test',
            onPress: () => router.push('/(features)/voice-test'),
          },
        ],
      );
      return;
    }
    void startCommandListening();
  }, [startCommandListening, testPassed]);

  const showWakeHint =
    wakePhraseSettingEnabled && (listeningForWakeWord || listeningForCommand || wakeWordEnabled);

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={handlePress}
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

      {!testPassed ? (
        <Pressable onPress={() => router.push('/(features)/voice-test')}>
          <AppText variant="caption" color="accent" align="center">
            Take voice test for better accuracy
          </AppText>
        </Pressable>
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
