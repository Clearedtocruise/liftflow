import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TextInput, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { FeatureGate } from '@/components/subscription/PremiumGate';
import { AppText } from '@/components/ui/AppText';
import { ComingSoonBanner } from '@/components/ui/ComingSoonBanner';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useWatchWorkout } from '@/hooks/useWatchWorkout';
import { integrationService } from '@/services/integrationService';

export default function AppleWatchScreen() {
  const { user } = useAuth();
  const watchAvailability = integrationService.getWatchAvailability();
  const { state, loading, error, refresh, correctReps, confirmReps, handleVoice, completeSet } =
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
    <ScreenContainer keyboardAvoiding>
      <View style={styles.header}>
        <AppText variant="title">Apple Watch</AppText>
        <AppText variant="body" color="textSecondary">
          Live workout state, rest tracking, and workout Q&amp;A on your wrist
        </AppText>
      </View>

      <FeatureGate featureId="apple-watch-advanced" featureName="Apple Watch workout assistant">
        <Card style={styles.card}>
          <AppText variant="bodyBold">Watch connectivity</AppText>
          <AppText variant="footnote" color="textSecondary">
            {watchAvailability.available
              ? 'Paired Watch receives live workout state, rest timers, and heart rate.'
              : watchAvailability.reason}
          </AppText>
        </Card>

        <View style={styles.banner}>
          <ComingSoonBanner
            title="Automatic Rep Counting Coming Soon"
            description="Reps are entered by hand for now. Motion-based rep detection is not part of this release."
          />
        </View>

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
            {active.phase === 'rest' && active.restSecondsRemaining != null ? (
              <AppText variant="headline" color="accent">
                Rest {active.restSecondsRemaining}s
              </AppText>
            ) : null}
            <View style={styles.metrics}>
              <Metric label="Reps entered" value={String(active.currentRepCount)} />
              <Metric label="Phase" value={active.phase} />
            </View>
            {state?.recoveryScore != null ? (
              <AppText variant="footnote" color="textSecondary">
                Recovery {state.recoveryScore} · {state.recoveryLabel}
              </AppText>
            ) : null}
            {state?.workoutRecommendation ? (
              <AppText variant="footnote" color="textTertiary">
                Today: {state.workoutRecommendation}
              </AppText>
            ) : null}
            {state?.progressionLine ? (
              <AppText variant="footnote" color="textTertiary">
                Progression: {state.progressionLine}
              </AppText>
            ) : null}
            {active.needsConfirmation ? (
              <AppText variant="footnote" color="accent" style={styles.warn}>
                Confirm the rep count or correct it below before logging.
              </AppText>
            ) : null}
            {state?.lastSpokenResponse ? (
              <AppText variant="body" style={styles.spoken}>
                {state.lastSpokenResponse}
              </AppText>
            ) : null}

            <View style={styles.row}>
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

        <SectionHeader title="Voice commands" subtitle="Log set · Next set · Recovery · What should I do next?" />
        <TextInput
          style={styles.input}
          placeholder='Try "Log set", "Next set", "How recovered am I?"'
          placeholderTextColor={LiftFlowColors.textTertiary}
          value={voiceInput}
          onChangeText={setVoiceInput}
          onSubmitEditing={onVoiceSubmit}
        />
        <PrimaryButton label="Ask assistant" onPress={onVoiceSubmit} variant="secondary" />

        <SectionHeader title="Rep count" subtitle="Enter the reps you completed" />
        <TextInput
          style={styles.input}
          placeholder="Rep count"
          placeholderTextColor={LiftFlowColors.textTertiary}
          keyboardType="number-pad"
          value={repCorrection}
          onChangeText={setRepCorrection}
        />
        <PrimaryButton label="Save rep count" onPress={onCorrectRep} variant="secondary" />
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
  banner: {
    marginBottom: Spacing.lg,
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
