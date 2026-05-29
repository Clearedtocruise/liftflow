import { Pressable, StyleSheet, View } from 'react-native';

import { AppSymbol, SYMBOL_FALLBACKS } from '@/components/ui/AppSymbol';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing, TouchTarget } from '@/constants/theme';

type MicrophoneButtonProps = {
  onPress?: () => void;
  isListening?: boolean;
};

export function MicrophoneButton({ onPress, isListening }: MicrophoneButtonProps) {
  return (
    <View style={styles.wrapper}>
      <View style={[styles.glow, isListening && styles.glowActive]} />
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          isListening && styles.buttonActive,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Start voice logging">
        <View style={styles.innerRing}>
          <AppSymbol
            name="mic.fill"
            fallback={SYMBOL_FALLBACKS['mic.fill']}
            size={36}
            tintColor={isListening ? LiftFlowColors.background : LiftFlowColors.accent}
          />
        </View>
      </Pressable>
      <AppText variant="footnote" color="textSecondary" align="center">
        {isListening ? 'Listening…' : 'Tap to log a set'}
      </AppText>
    </View>
  );
}

const BUTTON_SIZE = 88;

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  glow: {
    position: 'absolute',
    top: 0,
    width: BUTTON_SIZE + 24,
    height: BUTTON_SIZE + 24,
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
  innerRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    transform: [{ scale: 0.96 }],
  },
});
