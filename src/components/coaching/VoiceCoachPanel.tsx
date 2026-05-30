import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { MicrophoneButton } from '@/components/workout/MicrophoneButton';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useVoiceLogging } from '@/hooks/useVoiceLogging';
import { voiceCoachingService } from '@/services/voiceCoachingService';

export function VoiceCoachPanel() {
  const { user } = useAuth();
  const { isListening, transcript, transcriptRef, startListening, stopListening } = useVoiceLogging();
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastSessionId, setLastSessionId] = useState<string | null>(null);

  const handleMicPress = useCallback(async () => {
    if (!user) return;

    if (isListening) {
      stopListening();
      await new Promise((resolve) => setTimeout(resolve, 350));
      const question = transcriptRef.current.trim();
      if (!question) {
        Alert.alert('No speech detected', 'Try asking your coach a question again.');
        return;
      }

      setLoading(true);
      const result = await voiceCoachingService.askAndSpeak(user.id, {
        context: 'general',
        message: question,
      });
      setLoading(false);

      if (result.success) {
        setResponse(result.data.response);
        setLastSessionId(result.data.sessionId);
      } else {
        Alert.alert('Coach unavailable', result.error ?? 'Try again.');
      }
    } else {
      setResponse(null);
      voiceCoachingService.stopSpeaking();
      await startListening();
    }
  }, [isListening, stopListening, startListening, transcriptRef, user]);

  return (
    <Card style={styles.card}>
      <AppText variant="headline">Voice Coach</AppText>
      <AppText variant="body" color="textSecondary">
        Tap the mic and ask a coaching question. OpenAI generates the response and speaks it aloud.
      </AppText>

      <View style={styles.micRow}>
        <MicrophoneButton isListening={isListening || loading} onPress={handleMicPress} />
        {loading ? <ActivityIndicator color={LiftFlowColors.accent} /> : null}
      </View>

      {isListening && transcript ? (
        <AppText variant="caption" color="textSecondary">
          You: {transcript}
        </AppText>
      ) : null}

      {response ? (
        <View style={styles.responseBox}>
          <AppText variant="caption" color="accent">
            Coach {lastSessionId ? '· saved to history' : ''}
          </AppText>
          <AppText variant="body">{response}</AppText>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  micRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  responseBox: {
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LiftFlowColors.border,
  },
});
