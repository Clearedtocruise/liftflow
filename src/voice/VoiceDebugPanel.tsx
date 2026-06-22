import { StyleSheet } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { Spacing } from '@/constants/theme';

import { useVoiceWorkout } from './useVoiceWorkout';

export function VoiceDebugPanel() {
  const {
    transcript,
    lastCommand,
    listeningForWakeWord,
    listeningForCommand,
    wakeWordEnabled,
    wakePhraseSettingEnabled,
    voiceScopeActive,
    error,
  } = useVoiceWorkout();

  if (!__DEV__) return null;

  return (
    <Card style={styles.card}>
      <AppText variant="label">Voice Debug</AppText>
      <AppText variant="caption" color="textSecondary">
        Scope active: {String(voiceScopeActive)}
      </AppText>
      <AppText variant="caption" color="textSecondary">
        Settings wake phrase: {String(wakePhraseSettingEnabled)}
      </AppText>
      <AppText variant="caption" color="textSecondary">
        Wake word running: {String(wakeWordEnabled)}
      </AppText>
      <AppText variant="caption" color="textSecondary">
        Listening for wake word: {String(listeningForWakeWord)}
      </AppText>
      <AppText variant="caption" color="textSecondary">
        Listening for command: {String(listeningForCommand)}
      </AppText>
      <AppText variant="caption" color="textSecondary">
        Transcript: {transcript || 'None'}
      </AppText>
      <AppText variant="caption" color="textSecondary">
        Intent: {lastCommand?.intent ?? 'None'}
      </AppText>
      <AppText variant="caption" color="textSecondary">
        Exercise: {lastCommand?.exerciseName ?? 'None'}
      </AppText>
      <AppText variant="caption" color="textSecondary">
        Weight: {lastCommand?.weight ?? 'None'}
      </AppText>
      <AppText variant="caption" color="textSecondary">
        Reps: {lastCommand?.reps ?? 'None'}
      </AppText>
      <AppText variant="caption" color="error">
        Error: {error ?? 'None'}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
});
