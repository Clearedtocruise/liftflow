import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { VoiceComingSoonBanner } from '@/components/workout/VoiceComingSoonBanner';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { conversationalCoachService } from '@/services/conversationalCoachService';
import { COACH_STARTER_QUESTIONS, type ConversationalCoachResponse } from '@/types/conversationalCoach';

type ChatMessage = {
  id: string;
  role: 'user' | 'coach';
  text: string;
  shortAnswer?: string;
  detailedAnswer?: string;
  referencesUsed?: string[];
};

type DetailLevel = 'short' | 'detailed' | 'voice';

type ConversationalCoachPanelProps = {
  compact?: boolean;
  context?: 'workout' | 'recovery' | 'nutrition' | 'general';
};

export function ConversationalCoachPanel({ compact = false, context = 'general' }: ConversationalCoachPanelProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [detailLevel, setDetailLevel] = useState<DetailLevel>('detailed');
  const [loading, setLoading] = useState(false);
  const [memorySummary, setMemorySummary] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    const result = await conversationalCoachService.getHistory(user.id, 8);
    if (result.success) {
      setMemorySummary(result.data.summary);
      const historyMessages: ChatMessage[] = [];
      for (const turn of [...result.data.turns].reverse()) {
        if (turn.message) {
          historyMessages.push({ id: `${turn.id}-q`, role: 'user', text: turn.message });
        }
        historyMessages.push({
          id: turn.id,
          role: 'coach',
          text: turn.shortAnswer,
          shortAnswer: turn.shortAnswer,
        });
      }
      if (historyMessages.length > 0) setMessages(historyMessages.slice(-6));
    }
  }, [user]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function sendQuestion(question: string, level: DetailLevel = detailLevel) {
    if (!user || !question.trim()) return;

    setMessages((prev) => [...prev, { id: `${Date.now()}-u`, role: 'user', text: question.trim() }]);
    setInput('');
    setLoading(true);

    const result = await conversationalCoachService.ask(user.id, {
      message: question.trim(),
      context,
      includeHistory: true,
      detailLevel: level,
    });

    setLoading(false);

    if (!result.success) {
      Alert.alert('Coach unavailable', result.error);
      return;
    }

    appendCoachResponse(result.data, level);
    setMemorySummary(result.data.memorySummary);
  }

  function appendCoachResponse(data: ConversationalCoachResponse, level: DetailLevel) {
    const text = level === 'short' ? data.shortAnswer : level === 'voice' ? data.voiceLine : data.detailedAnswer;
    setMessages((prev) => [
      ...prev,
      {
        id: data.id ?? `${Date.now()}-c`,
        role: 'coach',
        text,
        shortAnswer: data.shortAnswer,
        detailedAnswer: data.detailedAnswer,
        referencesUsed: data.referencesUsed,
      },
    ]);
  }

  return (
    <Card style={styles.card}>
      <AppText variant="headline">ONE MORE Coach</AppText>
      <AppText variant="body" color="textSecondary">
        Context-aware answers from your workouts, recovery, nutrition, goals, photos, and success scores.
      </AppText>

      {memorySummary ? (
        <AppText variant="footnote" color="textTertiary">
          Memory: {memorySummary}
        </AppText>
      ) : null}

      <View style={styles.levelRow}>
        {(['short', 'detailed', 'voice'] as DetailLevel[]).map((level) => (
          <Pressable
            key={level}
            style={[styles.levelChip, detailLevel === level && styles.levelChipActive]}
            onPress={() => setDetailLevel(level)}>
            <AppText variant="caption" color={detailLevel === level ? 'accent' : 'textSecondary'}>
              {level === 'short' ? 'Short' : level === 'voice' ? 'Voice' : 'Detailed'}
            </AppText>
          </Pressable>
        ))}
      </View>

      {!compact ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {COACH_STARTER_QUESTIONS.map((q) => (
            <Pressable key={q.topic} style={styles.chip} onPress={() => sendQuestion(q.label)}>
              <AppText variant="caption" color="textSecondary">
                {q.label}
              </AppText>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.thread}>
        {messages.map((msg) => (
          <View
            key={msg.id}
            style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.coachBubble]}>
            <AppText variant="footnote" color={msg.role === 'user' ? 'accent' : 'textPrimary'}>
              {msg.text}
            </AppText>
            {msg.role === 'coach' && msg.referencesUsed?.length ? (
              <AppText variant="caption" color="textTertiary" style={styles.refLine}>
                Sources: {msg.referencesUsed.join(', ').replace(/_/g, ' ')}
              </AppText>
            ) : null}
          </View>
        ))}
        {loading ? <ActivityIndicator color={LiftFlowColors.accent} /> : null}
      </View>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Ask your coach…"
          placeholderTextColor={LiftFlowColors.textTertiary}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => sendQuestion(input)}
        />
      </View>

      <VoiceComingSoonBanner />

      <PrimaryButton label="Ask Coach" onPress={() => sendQuestion(input)} disabled={loading || !input.trim()} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.md, marginBottom: Spacing.xl },
  levelRow: { flexDirection: 'row', gap: Spacing.sm },
  levelChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.border,
  },
  levelChipActive: { borderColor: LiftFlowColors.accent },
  chipRow: { gap: Spacing.sm, paddingVertical: Spacing.xs },
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    backgroundColor: LiftFlowColors.surfaceElevated,
  },
  thread: { gap: Spacing.sm, maxHeight: 280 },
  bubble: { borderRadius: Radius.md, padding: Spacing.sm },
  userBubble: { alignSelf: 'flex-end', backgroundColor: LiftFlowColors.surfaceElevated, maxWidth: '90%' },
  coachBubble: { alignSelf: 'flex-start', backgroundColor: LiftFlowColors.background, borderWidth: StyleSheet.hairlineWidth, borderColor: LiftFlowColors.border, maxWidth: '95%' },
  refLine: { marginTop: Spacing.xs },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: LiftFlowColors.textPrimary,
  },
});
