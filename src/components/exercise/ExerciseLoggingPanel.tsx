import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useUnits } from '@/hooks/useUnits';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';
import { formatWorkoutWeightForInput } from '@/lib/unitConversion';
import { buildVoiceSetDraft } from '@/lib/voice/voiceSetDraft';
import { processVoiceTranscript } from '@/services/voiceService';
import { useWorkoutSession } from '@/state/workout/WorkoutSessionContext';
import type { ExerciseCardData } from '@/types/exerciseCard';

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

type ExerciseLoggingPanelProps = {
  exercise: ExerciseCardData;
  onLogged?: () => void;
};

export function ExerciseLoggingPanel({ exercise, onLogged }: ExerciseLoggingPanelProps) {
  const { user } = useAuth();
  const units = useUnits();
  const {
    activeSession,
    startSession,
    addExerciseByName,
    logSet,
    restSecondsRemaining,
    adjustRestTimer,
    skipRestTimer,
  } = useWorkoutSession();

  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [busy, setBusy] = useState(false);
  const [voiceLive, setVoiceLive] = useState(false);

  const isWeighted = exercise.metric === 'reps_weight';
  const isTimed = exercise.metric === 'time';

  const loggedSets = useMemo(() => {
    if (!activeSession) return [];
    const ex = activeSession.exercises.find(
      (e) => e.exercise?.name?.toLowerCase() === exercise.name.toLowerCase(),
    );
    return ex?.sets ?? [];
  }, [activeSession, exercise.name]);

  async function ensureExerciseId(): Promise<string | null> {
    if (!activeSession) return null;
    return addExerciseByName(exercise.name);
  }

  async function commitSet(weightKg: number | undefined, repsValue: number | undefined) {
    const workoutExerciseId = await ensureExerciseId();
    if (!workoutExerciseId) {
      Alert.alert('Could not log', 'Add this exercise to your session and try again.');
      return;
    }
    const result = await logSet({
      workoutExerciseId,
      weight: weightKg,
      reps: repsValue,
      type: 'normal',
    });
    if (result) {
      setWeight('');
      setReps('');
      onLogged?.();
    }
  }

  async function handleLog() {
    if (busy) return;
    const repsValue = reps ? parseInt(reps, 10) : undefined;
    const weightKg = isWeighted && weight ? units.parseWeight(weight) : undefined;
    if (!isTimed && !repsValue) {
      Alert.alert('Add reps', 'Enter how many reps you completed.');
      return;
    }
    setBusy(true);
    try {
      await commitSet(weightKg, repsValue);
    } finally {
      setBusy(false);
    }
  }

  async function handleStart() {
    if (!user) return;
    setBusy(true);
    try {
      await startSession({ name: 'Quick Workout' });
    } finally {
      setBusy(false);
    }
  }

  const { isListening, handlePressIn, handlePressOut, voiceUnavailable, error } = useVoiceRecognition({
    enabled: voiceLive && !!activeSession && !!user,
    inputMode: 'push_to_talk',
    onFinalTranscript: async (text) => {
      if (!user || !activeSession) return;
      const parseResult = await processVoiceTranscript(user.id, {
        transcript: text,
        sessionId: activeSession.id,
        context: {
          activeExerciseName: exercise.name,
          preferredWeightUnit: units.preferredWeightUnit,
          confirmationMode: 'none',
          autoLog: true,
        },
      });
      if (!parseResult.success) {
        Alert.alert('Could not parse', parseResult.error);
        return;
      }
      const parsed = parseResult.data.parsed;
      const draft = buildVoiceSetDraft(parsed, units.preferredWeightUnit);
      if (draft.weight != null) setWeight(draft.weight);
      if (draft.reps != null) setReps(draft.reps);
      await commitSet(draft.weightKg, draft.repsValue);
    },
  });

  return (
    <View style={styles.container}>
      {!activeSession ? (
        <View style={styles.startBlock}>
          <AppText variant="footnote" color="textSecondary" align="center">
            Start a session to log {exercise.name} without leaving this card.
          </AppText>
          <PrimaryButton label="Start Workout" onPress={handleStart} loading={busy} />
        </View>
      ) : (
        <>
          <View style={styles.inputRow}>
            {isWeighted ? (
              <View style={styles.inputBlock}>
                <AppText variant="label" color="textTertiary">
                  Weight ({units.weightLabel})
                </AppText>
                <TextInput
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={LiftFlowColors.textMuted}
                  style={styles.input}
                />
              </View>
            ) : null}
            <View style={styles.inputBlock}>
              <AppText variant="label" color="textTertiary">
                {isTimed ? 'Seconds' : 'Reps'}
              </AppText>
              <TextInput
                value={reps}
                onChangeText={setReps}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={LiftFlowColors.textMuted}
                style={styles.input}
              />
            </View>
            <Pressable
              onPressIn={() => {
                if (!voiceLive) setVoiceLive(true);
                if (!voiceUnavailable) void handlePressIn();
              }}
              onPressOut={() => {
                if (!voiceUnavailable) handlePressOut();
              }}
              style={[styles.mic, isListening && styles.micActive, voiceUnavailable && styles.micDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Hold to voice log set">
              <AppText variant="headline">🎤</AppText>
            </Pressable>
          </View>

          {voiceUnavailable || error ? (
            <AppText variant="caption" color="textSecondary" align="center">
              Voice temporarily unavailable. Use manual entry.
            </AppText>
          ) : null}

          <PrimaryButton label={busy ? 'Logging…' : 'Log Set'} onPress={handleLog} loading={busy} />

          <View style={styles.metaRow}>
            <AppText variant="caption" color="textSecondary">
              Sets this session: {loggedSets.length}
            </AppText>
            {isListening ? (
              <AppText variant="caption" color="primary">
                Listening…
              </AppText>
            ) : (
              <AppText variant="caption" color="textTertiary">
                Hold mic to log by voice
              </AppText>
            )}
          </View>

          {loggedSets.length > 0 ? (
            <View style={styles.setList}>
              {loggedSets.map((set) => (
                <View key={set.id} style={styles.setChip}>
                  <AppText variant="caption" color="textPrimary">
                    {set.weight != null
                      ? `${formatWorkoutWeightForInput(set.weight, units.preferredWeightUnit)} ${units.weightLabel} × ${set.reps ?? '—'}`
                      : `${set.reps ?? '—'} reps`}
                  </AppText>
                  {set.isPr ? (
                    <AppText variant="caption" color="accent">
                      {' '}
                      PR
                    </AppText>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          {restSecondsRemaining != null ? (
            <View style={styles.restBar}>
              <AppText variant="caption" color="restTimer">
                Rest
              </AppText>
              <AppText variant="bodyBold" color="restTimer">
                {formatClock(restSecondsRemaining)}
              </AppText>
              <View style={styles.restControls}>
                <Pressable onPress={() => adjustRestTimer(-15)} style={styles.restBtn}>
                  <AppText variant="caption" color="textSecondary">
                    −15
                  </AppText>
                </Pressable>
                <Pressable onPress={() => adjustRestTimer(15)} style={styles.restBtn}>
                  <AppText variant="caption" color="textSecondary">
                    +15
                  </AppText>
                </Pressable>
                <Pressable onPress={skipRestTimer} style={styles.restBtn}>
                  <AppText variant="caption" color="textSecondary">
                    Skip
                  </AppText>
                </Pressable>
              </View>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  startBlock: {
    gap: Spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.md,
  },
  inputBlock: {
    flex: 1,
    gap: Spacing.xs,
  },
  input: {
    backgroundColor: LiftFlowColors.background,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    minHeight: TouchTarget.min,
    color: LiftFlowColors.textPrimary,
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
  },
  mic: {
    width: TouchTarget.min,
    height: TouchTarget.min,
    borderRadius: Radius.full,
    backgroundColor: LiftFlowColors.surfaceHighlight,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micActive: {
    backgroundColor: LiftFlowColors.microphoneGlow,
    borderColor: LiftFlowColors.microphoneRing,
  },
  micDisabled: {
    opacity: 0.45,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  setList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  setChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: LiftFlowColors.surfaceHighlight,
  },
  restBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.restTimerMuted,
  },
  restControls: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginLeft: 'auto',
  },
  restBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});
