import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TextInput, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { FeatureGate } from '@/components/subscription/PremiumGate';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useWatchWorkout } from '@/hooks/useWatchWorkout';
import { isMotionTrackingSupported } from '@/integrations/watch';
import { integrationService } from '@/services/integrationService';

export default function AppleWatchScreen() {
  const { user } = useAuth();
  const watchAvailability = integrationService.getWatchAvailability();
  const { state, loading, error, supportedExercises, refresh, simulateRep, correctReps, confirmReps, handleVoice, completeSet } =
    useWatchWorkout(user?.id);

  const [voiceInput, setVoiceInput] = useState('');
  const [repCorrection, setRepCorrection] = useState('');

  const active = state?.activeSet;

  async function onVoiceSubmit() {
    if (!voiceInput.trim()) return;
    await handleVoice(voiceInput.trim());
    setVoiceInput('');
  }

  async function onCorrectRep() {
    const n = parseInt(repCorrection, 10);
    if (!Number.isFinite(n) || n < 0) {
      Alert.alert('Invalid rep', 'Enter a rep number like 8');
      return;
    }
    await correctReps(n);
    setRepCorrection('');
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <AppText variant="title">Apple Watch</AppText>
        <AppText variant="body" color="textSecondary">
          Hands-free rep counting, rest tracking, and workout Q&amp;A
        </AppText>
      </View>

      <FeatureGate featureId="apple-watch-advanced" featureName="Apple Watch workout assistant">
        <Card style={styles.card}>
          <AppText variant="bodyBold">Watch connectivity</AppText>
          <AppText variant="footnote" color="textSecondary">
            {watchAvailability.available
              ? 'Paired Watch can receive live workout state. Native watchOS app streams accelerometer + gyroscope batches.'
              : watchAvailability.reason}
          </AppText>
        </Card>

        {loading ? (
          <ActivityIndicator color={LiftFlowColors.accent} style={styles.loader} />
        ) : null}

        {error ? (
          <AppText variant="footnote" color="accent" style={styles.error}>
            {error}
          </AppText>
        ) : null}

        {active ? (
          <Card style={styles.card}>
            <AppText variant="bodyBold">{active.exerciseName}</AppText>
            <AppText variant="caption" color="textSecondary">
              Set {active.setNumber} of {active.targetSets} · Target {active.targetReps} reps
            </AppText>
            <View style={styles.metrics}>
              <Metric label="Reps" value={String(active.currentRepCount)} />
              <Metric
                label="Confidence"
                value={`${Math.round((active.motionConfidence ?? 0) * 100)}%`}
              />
              <Metric label="Phase" value={active.phase} />
            </View>
            {active.needsConfirmation ? (
              <AppText variant="footnote" color="accent" style={styles.warn}>
                Low motion confidence — confirm count or correct manually.
              </AppText>
            ) : null}
            {active.motionConfidence > 0 && !active.needsConfirmation && isMotionTrackingSupported(active.exerciseName) ? (
              <AppText variant="footnote" color="textSecondary">
                Motion tracking active for this exercise.
              </AppText>
            ) : null}
            {state?.lastSpokenResponse ? (
              <AppText variant="body" style={styles.spoken}>
                {state.lastSpokenResponse}
              </AppText>
            ) : null}

            <View style={styles.row}>
              <PrimaryButton label="Simulate rep (dev)" onPress={simulateRep} variant="secondary" />
              <PrimaryButton label="Confirm reps" onPress={confirmReps} variant="secondary" />
            </View>
            <PrimaryButton label="Complete set & log" onPress={completeSet} />
          </Card>
        ) : (
          <Card style={styles.card}>
            <AppText variant="body" color="textSecondary">
              Start a workout on your phone, then sync to begin Watch tracking.
            </AppText>
            <PrimaryButton label="Sync active workout" onPress={refresh} />
          </Card>
        )}

        <SectionHeader title="Voice commands" subtitle="Also available on Watch mic" />
        <TextInput
          style={styles.input}
          placeholder='Try "What rep am I on?" or "Correct to rep 8"'
          placeholderTextColor={LiftFlowColors.textTertiary}
          value={voiceInput}
          onChangeText={setVoiceInput}
          onSubmitEditing={onVoiceSubmit}
        />
        <PrimaryButton label="Ask assistant" onPress={onVoiceSubmit} variant="secondary" />

        <SectionHeader title="Manual rep correction" />
        <TextInput
          style={styles.input}
          placeholder="Rep count"
          placeholderTextColor={LiftFlowColors.textTertiary}
          keyboardType="number-pad"
          value={repCorrection}
          onChangeText={setRepCorrection}
        />
        <PrimaryButton label="Apply correction" onPress={onCorrectRep} variant="secondary" />

        <SectionHeader title="Motion-tracked exercises" />
        <AppText variant="footnote" color="textSecondary">
          {supportedExercises.join(' · ')}
        </AppText>
      </FeatureGate>
    </ScreenContainer>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <AppText variant="caption" color="textTertiary">
        {label}
      </AppText>
      <AppText variant="callout">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.xs,
    marginBottom: Spacing.xxl,
  },
  card: {
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  loader: {
    marginVertical: Spacing.lg,
  },
  error: {
    marginBottom: Spacing.md,
  },
  metrics: {
    flexDirection: 'row',
    gap: Spacing.xl,
    marginVertical: Spacing.md,
  },
  metric: {
    gap: Spacing.xs,
  },
  warn: {
    marginTop: Spacing.xs,
  },
  spoken: {
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
  row: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.border,
    borderRadius: 12,
    padding: Spacing.md,
    color: LiftFlowColors.textPrimary,
    marginBottom: Spacing.md,
  },
});
