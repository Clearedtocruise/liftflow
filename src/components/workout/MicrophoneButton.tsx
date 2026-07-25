import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppSymbol, SYMBOL_FALLBACKS } from '@/components/ui/AppSymbol';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing, TouchTarget } from '@/constants/theme';
import type { VoiceCaptureState } from '@/hooks/useVoiceRecognition';
import type { VoiceInputMode } from '@/types/voice';

type MicrophoneButtonProps = {
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  /** Real pipeline state. `isListening` is derived from it rather than passed separately. */
  state?: VoiceCaptureState;
  disabled?: boolean;
  inputMode?: VoiceInputMode;
  interimTranscript?: string;
  errorMessage?: string | null;
};

function hintText(inputMode: VoiceInputMode, state: VoiceCaptureState): string {
  if (state === 'transcribing') return 'Transcribing…';
  if (state === 'error') return 'Tap to try again';

  const listening = state === 'recording';
  if (inputMode === 'push_to_talk') {
    return listening ? 'Release to log…' : 'Hold to log a set';
  }
  if (inputMode === 'continuous') {
    return listening ? 'Listening continuously…' : 'Tap for continuous listening';
  }
  return listening ? 'Listening…' : 'Tap to log a set';
}

export function MicrophoneButton({
  onPress,
  onPressIn,
  onPressOut,
  state = 'idle',
  disabled,
  inputMode = 'push_to_talk',
  interimTranscript,
  errorMessage,
}: MicrophoneButtonProps) {
  const usePushToTalk = inputMode === 'push_to_talk';
  const isListening = state === 'recording';
  const isTranscribing = state === 'transcribing';
  // Pressing mid-transcription would start a second capture over the in-flight upload.
  const isBlocked = disabled || isTranscribing;
  const hint = hintText(inputMode, state);

  return (
    <View style={styles.wrapper}>
      <View style={[styles.glow, isListening && styles.glowActive]} />
      <Pressable
        onPress={usePushToTalk ? undefined : onPress}
        onPressIn={usePushToTalk ? onPressIn : undefined}
        onPressOut={usePushToTalk ? onPressOut : undefined}
        disabled={isBlocked}
        style={({ pressed }) => [
          styles.button,
          isListening && styles.buttonActive,
          isBlocked && styles.buttonDisabled,
          pressed && !isBlocked && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled: isBlocked, busy: isTranscribing }}
        accessibilityLabel={hint}>
        <View style={styles.innerRing}>
          {isTranscribing ? (
            <ActivityIndicator size="large" color={LiftFlowColors.accent} />
          ) : (
            <AppSymbol
              name="mic.fill"
              fallback={SYMBOL_FALLBACKS['mic.fill']}
              size={42}
              tintColor={isListening ? LiftFlowColors.background : LiftFlowColors.accent}
            />
          )}
        </View>
      </Pressable>
      <AppText variant="footnote" color="textSecondary" align="center">
        {hint}
      </AppText>
      {interimTranscript ? (
        <AppText variant="caption" color="accent" align="center" numberOfLines={2}>
          &quot;{interimTranscript}&quot;
        </AppText>
      ) : null}
      {state === 'error' && errorMessage ? (
        <AppText variant="caption" color="error" align="center" numberOfLines={3}>
          {errorMessage}
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
