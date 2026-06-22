import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';

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
    startCommandListening,
    error,
  } = useVoiceWorkout();

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={() => void startCommandListening()}
        disabled={disabled || listeningForCommand}
        style={({ pressed }) => [
          styles.primaryButton,
          listeningForCommand && styles.primaryActive,
          (disabled || listeningForCommand) && styles.disabled,
          pressed && !disabled && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={listeningForCommand ? 'Listening for workout command' : 'Tap to voice log'}>
        <AppText variant="bodyBold" color="textPrimary" align="center">
          {listeningForCommand ? 'Listening…' : 'Tap to Voice Log'}
        </AppText>
      </Pressable>

      {wakePhraseSettingEnabled ? (
        <View style={styles.wakeRow}>
          <View style={[styles.dot, wakeWordEnabled ? styles.dotOn : styles.dotOff]} />
          <AppText variant="footnote" color="textSecondary" align="center">
            {listeningForWakeWord
              ? 'Say “Hey OneMore”'
              : wakeWordEnabled
                ? 'Hey OneMore is on'
                : 'Hey OneMore enabled in Settings — wake word starting…'}
          </AppText>
        </View>
      ) : (
        <AppText variant="caption" color="textTertiary" align="center">
          Enable “Hey OneMore” in Settings for hands-free wake word.
        </AppText>
      )}

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
    gap: Spacing.sm,
    marginTop: Spacing.md,
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
    width: 8,
    height: 8,
    borderRadius: Radius.full,
  },
  dotOn: {
    backgroundColor: LiftFlowColors.success,
  },
  dotOff: {
    backgroundColor: LiftFlowColors.textTertiary,
  },
});
