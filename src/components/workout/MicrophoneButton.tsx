import { Pressable, StyleSheet, View } from 'react-native';

import { AppSymbol, SYMBOL_FALLBACKS } from '@/components/ui/AppSymbol';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing, TouchTarget } from '@/constants/theme';
import type { VoiceInputMode } from '@/types/voice';

type MicrophoneButtonProps = {
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  isListening?: boolean;
  disabled?: boolean;
  inputMode?: VoiceInputMode;
  interimTranscript?: string;
};

function hintText(inputMode: VoiceInputMode, isListening: boolean): string {
  if (inputMode === 'push_to_talk') {
    return isListening ? 'Release to log…' : 'Hold to log a set';
  }
  if (inputMode === 'continuous') {
    return isListening ? 'Listening continuously…' : 'Tap for continuous listening';
  }
  return isListening ? 'Listening…' : 'Tap to log a set';
}

export function MicrophoneButton({
  onPress,
  onPressIn,
  onPressOut,
  isListening,
  disabled,
  inputMode = 'push_to_talk',
  interimTranscript,
}: MicrophoneButtonProps) {
  const usePushToTalk = inputMode === 'push_to_talk';

  return (
    <View style={styles.wrapper}>
      <View style={[styles.glow, isListening && styles.glowActive]} />
      <Pressable
        onPress={usePushToTalk ? undefined : onPress}
        onPressIn={usePushToTalk ? onPressIn : undefined}
        onPressOut={usePushToTalk ? onPressOut : undefined}
        disabled={disabled}
        style={({ pressed }) => [
          styles.button,
          isListening && styles.buttonActive,
          disabled && styles.buttonDisabled,
          pressed && !disabled && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={hintText(inputMode, !!isListening)}>
        <View style={styles.innerRing}>
          <AppSymbol
            name="mic.fill"
            fallback={SYMBOL_FALLBACKS['mic.fill']}
            size={42}
            tintColor={isListening ? LiftFlowColors.background : LiftFlowColors.accent}
          />
        </View>
      </Pressable>
      <AppText variant="footnote" color="textSecondary" align="center">
        {hintText(inputMode, !!isListening)}
      </AppText>
      {interimTranscript ? (
        <AppText variant="caption" color="accent" align="center" numberOfLines={2}>
          "{interimTranscript}"
        </AppText>
      ) : null}
    </View>
  );
}

const BUTTON_SIZE = 104;

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: Spacing.sm,
    maxWidth: 280,
  },
  glow: {
    position: 'absolute',
    top: 0,
    width: BUTTON_SIZE + 28,
    height: BUTTON_SIZE + 28,
    borderRadius: Radius.full,
    backgroundColor: LiftFlowColors.microphoneGlow,
    opacity: 0.5,
  },
  glowActive: {
    opacity: 1,
    backgroundColor: LiftFlowColors.accentGlow,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    minWidth: TouchTarget.large,
    minHeight: TouchTarget.large,
    borderRadius: Radius.full,
    backgroundColor: LiftFlowColors.microphoneFill,
    borderWidth: 3,
    borderColor: LiftFlowColors.microphoneRing,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: LiftFlowColors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonActive: {
    backgroundColor: LiftFlowColors.accent,
    borderColor: LiftFlowColors.accent,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  innerRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    transform: [{ scale: 0.96 }],
  },
});
