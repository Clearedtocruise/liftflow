import { useCallback, useEffect, useRef, useState } from 'react';
import {
    AccessibilityInfo,
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { conversationalCoachService } from '@/services/conversationalCoachService';
import { COACH_STARTER_QUESTIONS, type ConversationalCoachResponse } from '@/types/conversationalCoach';

type ChatMessage = {
  id: string;
  role: 'user' | 'coach' | 'error';
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

const DETAIL_LABELS: Record<DetailLevel, string> = {
  short: 'Short',
  detailed: 'Detailed',
  voice: 'Voice',
};

export function ConversationalCoachPanel({ compact = false, context = 'general' }: ConversationalCoachPanelProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [detailLevel, setDetailLevel] = useState<DetailLevel>('detailed');
  const [loading, setLoading] = useState(false);
  const [memorySummary, setMemorySummary] = useState<string | null>(null);
  const threadRef = useRef<ScrollView | null>(null);
  const lastQuestionRef = useRef<{ question: string; level: DetailLevel } | null>(null);

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
    if (!user || !question.trim() || loading) return;

    lastQuestionRef.current = { question: question.trim(), level };
    setMessages((prev) => [
      ...prev.filter((msg) => msg.role !== 'error'),
      { id: `${Date.now()}-u`, role: 'user', text: question.trim() },
    ]);
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
      // An alert used to leave the user's question sitting in the thread with no reply and no way
      // to retry, and it surfaced raw strings like "API error 500".
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-e`,
          role: 'error',
          text: "Your coach couldn't answer that just now. Check your connection and try again.",
        },
      ]);
      AccessibilityInfo.announceForAccessibility('Coach unavailable. Tap retry to try again.');
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
    AccessibilityInfo.announceForAccessibility(text);
  }

  const hasError = messages.some((msg) => msg.role === 'error');
  const starterQuestions = compact ? COACH_STARTER_QUESTIONS.slice(0, 3) : COACH_STARTER_QUESTIONS;

  return (
    <Card style={styles.card}>
      <AppText variant="headline">ONE MORE Coach</AppText>
      <AppText variant="body" color="textSecondary">
        Context-aware answers from your workouts, recovery, nutrition, goals, photos, and success scores.
      </AppText>

      {memorySummary ? (
        <AppText variant="footnote" color="textTertiary">
          Your coach remembers: {memorySummary}
        </AppText>
      ) : null}

      <View style={styles.levelRow} accessibilityRole="radiogroup">
        {(['short', 'detailed', 'voice'] as DetailLevel[]).map((level) => (
          <Pressable
            key={level}
            accessibilityRole="radio"
            accessibilityLabel={`${DETAIL_LABELS[level]} answers`}
            accessibilityState={{ selected: detailLevel === level }}
            hitSlop={8}
            style={[styles.levelChip, detailLevel === level && styles.levelChipActive]}
            onPress={() => setDetailLevel(level)}>
            <AppText variant="caption" color={detailLevel === level ? 'accent' : 'textSecondary'}>
              {DETAIL_LABELS[level]}
            </AppText>
          </Pressable>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {starterQuestions.map((q) => (
          <Pressable
            key={q.topic}
            accessibilityRole="button"
            accessibilityLabel={q.label}
            accessibilityState={{ disabled: loading }}
            disabled={loading}
            style={[styles.chip, loading && styles.chipDisabled]}
            onPress={() => sendQuestion(q.label)}>
            <AppText variant="caption" color="textSecondary">
              {q.label}
            </AppText>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        ref={threadRef}
        style={styles.thread}
        contentContainerStyle={styles.threadContent}
        accessibilityLiveRegion="polite"
        onContentSizeChange={() => threadRef.current?.scrollToEnd({ animated: true })}>
        {messages.length === 0 && !loading ? (
          <AppText variant="footnote" color="textTertiary">
            Ask anything about your training, recovery, or nutrition — or tap a question above to start.
          </AppText>
        ) : null}
        {messages.map((msg) => (
          <View
            key={msg.id}
            style={[
              styles.bubble,
              msg.role === 'user'
                ? styles.userBubble
                : msg.role === 'error'
                  ? styles.errorBubble
                  : styles.coachBubble,
            ]}>
            <AppText
              variant="footnote"
              color={msg.role === 'user' ? 'accent' : msg.role === 'error' ? 'error' : 'textPrimary'}>
              {msg.text}
            </AppText>
            {msg.role === 'coach' && msg.referencesUsed?.length ? (
              <AppText variant="caption" color="textTertiary" style={styles.refLine}>
                Sources: {msg.referencesUsed.join(', ').replace(/_/g, ' ')}
              </AppText>
            ) : null}
          </View>
        ))}
        {loading ? (
          <View
            accessible
            accessibilityLabel="Coach is thinking"
            style={[styles.bubble, styles.coachBubble, styles.thinkingBubble]}>
            <ActivityIndicator color={LiftFlowColors.accent} />
            <AppText variant="footnote" color="textSecondary">
              Coach is thinking…
            </AppText>
          </View>
        ) : null}
      </ScrollView>

      {hasError && lastQuestionRef.current ? (
        <PrimaryButton
          label="Retry"
          variant="secondary"
          onPress={() => {
            const last = lastQuestionRef.current;
            if (last) void sendQuestion(last.question, last.level);
          }}
        />
      ) : null}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          accessibilityLabel="Ask your coach a question"
          placeholder="Ask your coach…"
          placeholderTextColor={LiftFlowColors.textTertiary}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => sendQuestion(input)}
        />
      </View>

      <PrimaryButton
        label="Ask Coach"
        loading={loading}
        onPress={() => sendQuestion(input)}
        disabled={loading || !input.trim()}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.md, marginBottom: Spacing.xl },
  levelRow: { flexDirection: 'row', gap: Spacing.sm },
  levelChip: {
    minHeight: TouchTarget.min,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.border,
  },
  levelChipActive: { borderColor: LiftFlowColors.accent },
  chipRow: { gap: Spacing.sm, paddingVertical: Spacing.xs },
  chip: {
    minHeight: TouchTarget.min,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
    backgroundColor: LiftFlowColors.surfaceElevated,
  },
  chipDisabled: { opacity: 0.5 },
  thread: { maxHeight: 280 },
  threadContent: { gap: Spacing.sm },
  bubble: { borderRadius: Radius.md, padding: Spacing.sm },
  userBubble: { alignSelf: 'flex-end', backgroundColor: LiftFlowColors.surfaceElevated, maxWidth: '90%' },
  coachBubble: { alignSelf: 'flex-start', backgroundColor: LiftFlowColors.background, borderWidth: StyleSheet.hairlineWidth, borderColor: LiftFlowColors.border, maxWidth: '95%' },
  errorBubble: {
    alignSelf: 'stretch',
    backgroundColor: LiftFlowColors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.error,
  },
  thinkingBubble: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  refLine: { marginTop: Spacing.xs },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  input: {
    flex: 1,
    minHeight: TouchTarget.min,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: LiftFlowColors.textPrimary,
  },
});
