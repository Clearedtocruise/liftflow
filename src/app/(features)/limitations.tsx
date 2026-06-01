import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { MicrophoneButton } from '@/components/workout/MicrophoneButton';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useVoiceLogging } from '@/hooks/useVoiceLogging';
import { limitationService } from '@/services/limitationService';
import type { LimitationType, TrainingLimitation } from '@/types/coaching';

const BODY_AREAS = ['Shoulder', 'Elbow', 'Knee', 'Lower Back', 'Hip', 'Wrist', 'Neck', 'Ankle'];
const TYPES: LimitationType[] = ['injury', 'pain', 'tightness', 'mobility', 'discomfort'];

export default function LimitationsScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<TrainingLimitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [bodyArea, setBodyArea] = useState('Shoulder');
  const [limitationType, setLimitationType] = useState<LimitationType>('pain');
  const [description, setDescription] = useState('');
  const [painScore, setPainScore] = useState('5');
  const [isDiagnosed, setIsDiagnosed] = useState(false);

  const { isListening, transcript, startListening, stopListening, clearTranscript } = useVoiceLogging();

  const load = useCallback(async () => {
    if (!user) return;
    const result = await limitationService.list(user.id, true);
    if (result.success) setItems(result.data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!isListening && transcript.trim()) {
      setDescription(transcript.trim());
      clearTranscript();
    }
  }, [isListening, transcript]);

  async function handleAdd() {
    if (!user) return;
    const result = await limitationService.create(user.id, {
      limitationType,
      bodyArea,
      painScore: parseInt(painScore, 10) || 5,
      isDiagnosed,
      description: description.trim() || undefined,
      voiceText: description.trim() || undefined,
    });

    if (result.success) {
      setDescription('');
      load();
      Alert.alert(
        'Logged',
        'Limitation saved. Workouts will substitute exercises where possible. This is not a medical diagnosis.',
      );
    } else {
      Alert.alert('Error', result.error);
    }
  }

  async function handleResolve(id: string) {
    const result = await limitationService.resolve(id);
    if (result.success) load();
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={LiftFlowColors.accent} />
      </View>
    );
  }

  return (
    <ScreenContainer>
      <Pressable onPress={() => router.back()}>
        <AppText variant="body" color="accent">
          ← Back
        </AppText>
      </Pressable>

      <AppText variant="title" style={styles.title}>
        Injuries & Limitations
      </AppText>
      <AppText variant="body" color="textSecondary">
        Track pain and restrictions — AI will suggest substitutions. Not medical advice.
      </AppText>

      <Card style={styles.form}>
        <AppText variant="bodyBold">Add limitation</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {BODY_AREAS.map((area) => (
            <Pressable
              key={area}
              style={[styles.chip, bodyArea === area && styles.chipActive]}
              onPress={() => setBodyArea(area)}>
              <AppText variant="caption">{area}</AppText>
            </Pressable>
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {TYPES.map((type) => (
            <Pressable
              key={type}
              style={[styles.chip, limitationType === type && styles.chipActive]}
              onPress={() => {
                setLimitationType(type);
                setIsDiagnosed(type === 'injury');
              }}>
              <AppText variant="caption">{type}</AppText>
            </Pressable>
          ))}
        </ScrollView>
        <TextInput
          style={styles.input}
          placeholder='e.g. "My shoulder hurts when pressing"'
          placeholderTextColor={LiftFlowColors.textTertiary}
          value={description}
          onChangeText={setDescription}
          multiline
        />
        <View style={styles.micRow}>
          <MicrophoneButton
            isListening={isListening}
            onPress={() => (isListening ? stopListening() : startListening())}
          />
          <TextInput
            style={[styles.input, styles.painInput]}
            placeholder="Pain 1–10"
            keyboardType="number-pad"
            value={painScore}
            onChangeText={setPainScore}
          />
        </View>
        <PrimaryButton label="Save Limitation" onPress={handleAdd} />
      </Card>

      {items.length === 0 ? (
        <AppText variant="body" color="textSecondary">
          No active limitations.
        </AppText>
      ) : (
        items.map((item) => (
          <Card key={item.id} style={styles.item}>
            <AppText variant="bodyBold">
              {item.bodyArea} · {item.limitationType}
              {item.isDiagnosed ? ' (diagnosed)' : ''}
            </AppText>
            {item.description ? (
              <AppText variant="footnote" color="textSecondary">
                {item.description}
              </AppText>
            ) : null}
            <AppText variant="caption" color="textTertiary">
              Pain {item.painScore ?? '—'}/10
            </AppText>
            <PrimaryButton label="Mark resolved" variant="secondary" onPress={() => handleResolve(item.id)} />
          </Card>
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: Spacing.lg, marginBottom: Spacing.sm },
  form: { gap: Spacing.md, marginVertical: Spacing.xxl },
  chipRow: { gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: LiftFlowColors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.border,
  },
  chipActive: { borderColor: LiftFlowColors.accentMuted, backgroundColor: LiftFlowColors.accentGlow },
  input: {
    backgroundColor: LiftFlowColors.background,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    color: LiftFlowColors.textPrimary,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    minHeight: 80,
  },
  micRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  painInput: { flex: 1, minHeight: 48 },
  item: { gap: Spacing.sm, marginBottom: Spacing.md },
});
