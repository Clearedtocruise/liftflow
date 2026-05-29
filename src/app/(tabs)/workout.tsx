import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { AppText } from '@/components/ui/AppText';
import { MicrophoneButton } from '@/components/workout/MicrophoneButton';
import { QuickCorrectionButtons } from '@/components/workout/QuickCorrectionButtons';
import { RestTimerSection } from '@/components/workout/RestTimerSection';
import { VoiceConfirmModal } from '@/components/workout/VoiceConfirmModal';
import { WorkoutCard } from '@/components/workout/WorkoutCard';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useVoiceLogging } from '@/hooks/useVoiceLogging';
import { voiceService } from '@/services/voiceService';
import { workoutService } from '@/services/workoutService';
import type { ParsedVoiceCommand, WorkoutSession } from '@/types';

export default function WorkoutScreen() {
  const { user } = useAuth();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [parsed, setParsed] = useState<ParsedVoiceCommand | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pendingEntryId, setPendingEntryId] = useState<string | null>(null);

  const { transcript, isListening, startListening, stopListening, clearTranscript } = useVoiceLogging();

  const loadSession = useCallback(
    async (options?: { createIfMissing?: boolean }) => {
      if (!user) return;
      setLoading(true);
      const result = await workoutService.getActiveSession(user.id);
      if (result.success && result.data) {
        setSession(result.data);
      } else if (options?.createIfMissing) {
        const startResult = await workoutService.startSession(user.id, { name: 'Workout' });
        if (startResult.success && startResult.data) setSession(startResult.data);
        else setSession(null);
      } else {
        setSession(null);
      }
      setLoading(false);
    },
    [user],
  );

  useEffect(() => {
    loadSession({ createIfMissing: true });
  }, [loadSession]);

  useEffect(() => {
    if (!isListening && transcript.trim()) {
      handleParseTranscript(transcript);
    }
  }, [isListening, transcript]);

  async function handleParseTranscript(text: string) {
    if (!user || !session) return;

    const parseResult = await voiceService.parseCommand({
      transcript: text,
      sessionId: session.id,
    });

    if (!parseResult.success) {
      Alert.alert('Could not parse', parseResult.error);
      clearTranscript();
      return;
    }

    setParsed(parseResult.data.parsed);

    const logResult = await voiceService.logEntry(user.id, {
      userId: user.id,
      sessionId: session.id,
      rawTranscript: text,
      status: parseResult.data.requiresConfirmation ? 'parsed' : 'confirmed',
      confidence: parseResult.data.confidence,
      parsedData: parseResult.data.parsed,
    });

    if (logResult.success) {
      setPendingEntryId(logResult.data.id);
      if (parseResult.data.requiresConfirmation) {
        setConfirmVisible(true);
      } else {
        await saveParsedSet(parseResult.data.parsed);
        await voiceService.confirmEntry(logResult.data.id);
      }
    }
  }

  async function saveParsedSet(command: ParsedVoiceCommand) {
    if (!user || !session || !command.exercise) return;

    const exerciseIdResult = await workoutService.findOrCreateExerciseByName(command.exercise, user.id);
    if (!exerciseIdResult.success) {
      Alert.alert('Error', exerciseIdResult.error);
      return;
    }

    let workoutExercise = session.exercises.find((e) => e.exerciseId === exerciseIdResult.data);
    if (!workoutExercise) {
      const addResult = await workoutService.addExercise(session.id, exerciseIdResult.data);
      if (!addResult.success) {
        Alert.alert('Error', addResult.error);
        return;
      }
      workoutExercise = addResult.data;
    }

    const setResult = await workoutService.logSet({
      workoutExerciseId: workoutExercise.id,
      weight: command.weight,
      reps: command.reps,
    });

    if (setResult.success) {
      await loadSession({ createIfMissing: true });
      clearTranscript();
      setConfirmVisible(false);
      setParsed(null);
    } else {
      Alert.alert('Error', setResult.error);
    }
  }

  async function handleMicPress() {
    if (isListening) {
      stopListening();
    } else {
      await startListening();
    }
  }

  async function handleConfirm() {
    if (parsed) await saveParsedSet(parsed);
    if (pendingEntryId) await voiceService.confirmEntry(pendingEntryId);
    setConfirmVisible(false);
  }

  async function handleReject() {
    if (pendingEntryId) await voiceService.rejectEntry(pendingEntryId);
    setConfirmVisible(false);
    setParsed(null);
    clearTranscript();
  }

  async function handleFinishWorkout() {
    if (!session) return;
    const result = await workoutService.endSession(session.id);
    if (result.success) {
      Alert.alert('Workout complete', `Duration: ${Math.round((result.data.durationSeconds ?? 0) / 60)} min`);
      await loadSession({ createIfMissing: false });
    }
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={LiftFlowColors.accent} />
      </View>
    );
  }

  if (!session) {
    return (
      <ScreenContainer contentContainerStyle={styles.scrollContent}>
        <AppText variant="title">Workout</AppText>
        <AppText variant="body" color="textSecondary" style={styles.emptyCopy}>
          No active session. Start a workout to begin logging sets.
        </AppText>
        <PrimaryButton
          label="Start Workout"
          onPress={() => loadSession({ createIfMissing: true })}
        />
      </ScreenContainer>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenContainer bottomInset={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View>
            <AppText variant="caption" color="accent">
              {session.isActive ? 'Active Session' : 'Ready'}
            </AppText>
            <AppText variant="title">{session.name}</AppText>
          </View>
          <View style={styles.sessionMeta}>
            <AppText variant="footnote" color="textSecondary">
              {session.exercises.length} exercises · {session.totalSets ?? 0} sets
            </AppText>
          </View>
        </View>

        {session.isActive ? (
          <PrimaryButton label="Finish Workout" onPress={handleFinishWorkout} variant="secondary" />
        ) : null}

        <RestTimerSection />

        <SectionHeader title="Exercises" subtitle="Tap mic to log your next set" />

        {session.exercises.length === 0 ? (
          <AppText variant="body" color="textSecondary">
            Say "Bench press 225 for 8" to log your first set.
          </AppText>
        ) : (
          session.exercises.map((exercise) => <WorkoutCard key={exercise.id} exercise={exercise} />)
        )}

        <SectionHeader title="Quick Corrections" />
        <QuickCorrectionButtons />

        <View style={styles.micSpacer} />
      </ScreenContainer>

      <View style={styles.micDock}>
        <MicrophoneButton onPress={handleMicPress} isListening={isListening} />
      </View>

      <VoiceConfirmModal
        visible={confirmVisible}
        parsed={parsed}
        transcript={transcript}
        onConfirm={handleConfirm}
        onReject={handleReject}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LiftFlowColors.background,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LiftFlowColors.background,
  },
  scrollContent: {
    paddingBottom: Spacing.huge,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xxl,
  },
  sessionMeta: {
    alignItems: 'flex-end',
  },
  emptyCopy: {
    marginVertical: Spacing.xxl,
  },
  micSpacer: {
    height: 140,
  },
  micDock: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
});
