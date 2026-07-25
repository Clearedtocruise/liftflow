import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import type { WorkoutChallengeTemplate, WorkoutChallengeTrigger } from '@/types/workoutChallenge';

type WorkoutChallengeModalProps = {
  visible: boolean;
  challenge: WorkoutChallengeTemplate | null;
  exerciseName?: string;
  trigger: WorkoutChallengeTrigger;
  onSkip: () => void;
  onComplete: (loggedValue?: string) => void;
};

function challengeContextLine(
  trigger: WorkoutChallengeTrigger,
  exerciseName?: string,
): string {
  if (!exerciseName) {
    return trigger === 'between_exercises'
      ? 'Applies to your next exercise'
      : 'Applies to your current exercise';
  }
  return trigger === 'between_exercises'
    ? `For your next exercise: ${exerciseName}`
    : `For ${exerciseName} — next set`;
}

export function WorkoutChallengeModal({
  visible,
  challenge,
  exerciseName,
  trigger,
  onSkip,
  onComplete,
}: WorkoutChallengeModalProps) {
  const [phase, setPhase] = useState<'prompt' | 'log'>('prompt');
  const [loggedValue, setLoggedValue] = useState('');

  useEffect(() => {
    if (visible) {
      setPhase('prompt');
      setLoggedValue('');
    }
  }, [visible, challenge?.id]);

  if (!challenge) return null;

  function handleDismissSkip() {
    setPhase('prompt');
    setLoggedValue('');
    onSkip();
  }

  function handleAccept() {
    setPhase('log');
  }

  function handleLog() {
    const value = loggedValue.trim();
    setPhase('prompt');
    setLoggedValue('');
    onComplete(value || undefined);
  }

  function handleClose() {
    setPhase('prompt');
    setLoggedValue('');
  }

  const contextLine = challengeContextLine(trigger, exerciseName);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.card}>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <AppText variant="caption" color="warning">
                Coach Challenge
              </AppText>
            </View>
            <AppText variant="caption" color="textTertiary">
              Optional · Not part of your plan
            </AppText>
          </View>

          <View style={styles.exerciseBlock}>
            <AppText variant="label" color="textSecondary">
              Exercise
            </AppText>
            <AppText variant="headline" style={styles.exerciseName}>
              {exerciseName ?? 'Current exercise'}
            </AppText>
            <AppText variant="footnote" color="textTertiary">
              {contextLine}
            </AppText>
          </View>

          <AppText variant="title" style={styles.title}>
            {challenge.title}
          </AppText>

          <AppText variant="body" color="textSecondary">
            {challenge.prompt}
          </AppText>

          {phase === 'prompt' ? (
            <View style={styles.actions}>
              <PrimaryButton label="Accept Challenge" onPress={handleAccept} size="large" />
              <PrimaryButton label="Skip" onPress={handleDismissSkip} variant="secondary" />
            </View>
          ) : (
            <View style={styles.actions}>
              {challenge.logLabel ? (
                <View style={styles.inputBlock}>
                  <AppText variant="label" color="textSecondary">
                    {challenge.logLabel}
                  </AppText>
                  <TextInput
                    value={loggedValue}
                    onChangeText={setLoggedValue}
                    placeholder={challenge.logPlaceholder ?? 'Optional'}
                    placeholderTextColor={LiftFlowColors.textTertiary}
                    style={styles.input}
                    keyboardType={challenge.kind === 'reps' || challenge.kind === 'finisher' || challenge.kind === 'drop_set' ? 'number-pad' : 'default'}
                  />
                </View>
              ) : null}
              <PrimaryButton label="Log Challenge" onPress={handleLog} size="large" />
              <PrimaryButton label="Skip" onPress={handleDismissSkip} variant="ghost" />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: LiftFlowColors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: LiftFlowColors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 200, 87, 0.35)',
    padding: Spacing.xxl,
    gap: Spacing.md,
  },
  badgeRow: {
    gap: Spacing.xs,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255, 200, 87, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 200, 87, 0.35)',
  },
  exerciseBlock: {
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.backgroundSecondary,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  exerciseName: {
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
  },
  actions: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  inputBlock: {
    gap: Spacing.xs,
  },
  input: {
    backgroundColor: LiftFlowColors.backgroundSecondary,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: LiftFlowColors.textPrimary,
    fontSize: 16,
  },
});
