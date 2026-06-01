import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { FeatureGate } from '@/components/subscription/PremiumGate';
import { AppText } from '@/components/ui/AppText';
import { ManualSetEntry } from '@/components/workout/ManualSetEntry';
import { MicrophoneButton } from '@/components/workout/MicrophoneButton';
import { QuickCorrectionButtons } from '@/components/workout/QuickCorrectionButtons';
import { RestTimerSection } from '@/components/workout/RestTimerSection';
import { SetEditModal } from '@/components/workout/SetEditModal';
import { SmartProgressionCard } from '@/components/workout/SmartProgressionCard';
import { StartWorkoutPrompt } from '@/components/workout/StartWorkoutPrompt';
import { VoiceConfirmModal } from '@/components/workout/VoiceConfirmModal';
import { WorkoutCard } from '@/components/workout/WorkoutCard';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { buildWorkoutSessionName, pickDefaultLocation } from '@/constants/trainingProfile';
import { DEFAULT_REST_SECONDS } from '@/constants/workout';
import { useAuth } from '@/hooks/useAuth';
import { useEntitlement } from '@/hooks/useEntitlement';
import { useNearbyWorkoutLocation } from '@/hooks/useNearbyWorkoutLocation';
import { useUnits } from '@/hooks/useUnits';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';
import { useVoiceSettings } from '@/hooks/useVoiceSettings';
import { useWorkoutLocations } from '@/hooks/useWorkoutLocations';
import { formatWorkoutWeightForInput, normalizeVoiceWeightToKg, weightStepKg } from '@/lib/unitConversion';
import { speakVoiceConfirmation } from '@/lib/voice';
import { bodyService } from '@/services/bodyService';
import { conversationalCoachService } from '@/services/conversationalCoachService';
import { peakMusicService } from '@/services/peakMusicService';
import { productAnalyticsService } from '@/services/productAnalyticsService';
import { recoveryService } from '@/services/recoveryService';
import { socialShareService } from '@/services/socialShareService';
import { voiceCoachingService } from '@/services/voiceCoachingService';
import { processVoiceTranscript, voiceService } from '@/services/voiceService';
import { workoutRecommendationService } from '@/services/workoutRecommendationService';
import { useWorkoutSession } from '@/state/workout/WorkoutSessionContext';
import type { ParsedVoiceCommand, WorkoutSet } from '@/types';

export default function WorkoutScreen() {
  const { user } = useAuth();
  const units = useUnits();
  const { allowed: transformationAllowed } = useEntitlement('transformation-engine');
  const { allowed: peakMusicAllowed } = useEntitlement('peak-music-sync');
  const {
    activeSession: session,
    isLoading: loading,
    restSecondsRemaining,
    activeRestPeriod,
    lastLoggedSet,
    startSession,
    endSession,
    pauseSession,
    resumeSession,
    cancelSession,
    logSet,
    updateSet,
    deleteSet,
    addExerciseByName,
    adjustRestTimer,
    skipRestTimer,
    setListening,
  } = useWorkoutSession();

  const { locations, selectedId, setSelectedId, loading: locationsLoading } = useWorkoutLocations(user?.id);
  const nearby = useNearbyWorkoutLocation({
    userId: user?.id,
    locations,
    enabled: session === null && !loading,
    onMatch: (match) => {
      if (match) setSelectedId(match.location.id);
    },
  });

  const [parsed, setParsed] = useState<ParsedVoiceCommand | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pendingEntryId, setPendingEntryId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [editSet, setEditSet] = useState<WorkoutSet | null>(null);
  const [editExerciseName, setEditExerciseName] = useState('');
  const [activeExerciseName, setActiveExerciseName] = useState<string | undefined>();
  const [recoveryScore, setRecoveryScore] = useState<number | undefined>();

  const { settings: voiceSettings } = useVoiceSettings(user?.id);

  const handleParseTranscript = async (text: string) => {
    if (!user || !session || session.status === 'paused' || !text.trim()) return;

    const activeEx =
      activeExerciseName ??
      session.exercises.find((e) => e.isActive)?.exercise?.name ??
      session.exercises[session.exercises.length - 1]?.exercise?.name;

    const parseResult = await processVoiceTranscript(user.id, {
      transcript: text,
      sessionId: session.id,
      context: {
        activeExerciseName: activeEx,
        lastWeight: lastLoggedSet?.weight,
        lastReps: lastLoggedSet?.reps,
        preferredWeightUnit: units.preferredWeightUnit,
        confirmationMode: voiceSettings.confirmationMode,
        autoLog: voiceSettings.autoLog,
      },
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
  };

  const {
    transcript,
    interimTranscript,
    isListening,
    clearTranscript,
    handlePressIn,
    handlePressOut,
    handleMicPress,
  } = useVoiceRecognition({
    enabled: !!session && session.status !== 'paused',
    inputMode: voiceSettings.inputMode,
    onFinalTranscript: handleParseTranscript,
  });

  useEffect(() => {
    setListening(isListening);
  }, [isListening, setListening]);

  useEffect(() => {
    if (!user?.id || !session) return;
    recoveryService.getIntelligence(user.id).then((result) => {
      if (result.success) setRecoveryScore(result.data.recoveryScore);
    });
  }, [user?.id, session?.id]);

  async function handleStartWorkout() {
    if (!user) return;
    const location = pickDefaultLocation(locations, selectedId);
    setStarting(true);
    const started = await startSession({
      name: buildWorkoutSessionName(user, location),
      gymName: location?.name ?? user.primaryGymName ?? undefined,
      trainingLocation: location?.locationType ?? user.trainingLocation,
      workoutLocationId: location?.id,
    });
    setStarting(false);
    if (!started) Alert.alert('Could not start', 'Unable to start workout session.');
  }

  async function saveParsedSet(command: ParsedVoiceCommand) {
    if (!user || !session || session.status === 'paused') return;

    if (command.intent === 'undo_last_set' || command.intent === 'delete_last_set') {
      if (!lastLoggedSet) {
        Alert.alert('Nothing to undo', 'Log a set first.');
        return;
      }
      await deleteSet(lastLoggedSet.id);
      speakVoiceConfirmation(command, voiceSettings.voiceFeedback, units.weightLabel);
      clearTranscript();
      setConfirmVisible(false);
      setParsed(null);
      return;
    }

    if (command.intent === 'next_set' || command.intent === 'completed_set') {
      await skipRestTimer();
      speakVoiceConfirmation(command, voiceSettings.voiceFeedback, units.weightLabel);
      clearTranscript();
      setConfirmVisible(false);
      setParsed(null);
      return;
    }

    if (command.intent === 'declare_exercise' && command.exercise) {
      setActiveExerciseName(command.exercise);
      await addExerciseByName(command.exercise);
      speakVoiceConfirmation(command, voiceSettings.voiceFeedback, units.weightLabel);
      clearTranscript();
      setConfirmVisible(false);
      setParsed(null);
      return;
    }

    if (command.intent === 'recovery_query') {
      const intel = await recoveryService.getIntelligence(user.id);
      if (!intel.success) {
        Alert.alert('Recovery unavailable', intel.error);
        return;
      }
      const enriched = {
        ...command,
        recoveryVoiceLine: intel.data.voiceRecoveryLine,
      };
      speakVoiceConfirmation(enriched, voiceSettings.voiceFeedback, units.weightLabel);
      Alert.alert(
        'Recovery',
        `${intel.data.recoveryStatusLabel} · ${intel.data.trainingRecommendationLabel}\n\n${intel.data.voiceRecoveryLine}`,
      );
      clearTranscript();
      setConfirmVisible(false);
      setParsed(null);
      return;
    }

    if (command.intent === 'coach_query') {
      const coach = await conversationalCoachService.ask(user.id, {
        context: 'workout',
        message: command.rawText,
        includeHistory: true,
        detailLevel: 'voice',
      });
      if (!coach.success) {
        Alert.alert('Coach unavailable', coach.error);
        return;
      }
      void productAnalyticsService.trackAiCoach(user.id, 'workout');
      await voiceCoachingService.speakLine(coach.data.voiceLine);
      Alert.alert('ONE MORE Coach', coach.data.detailedAnswer);
      clearTranscript();
      setConfirmVisible(false);
      setParsed(null);
      return;
    }

    if (command.intent === 'transformation_query' || command.intent === 'transformation_progress' || command.intent === 'transformation_target_bf') {
      if (!transformationAllowed) {
        Alert.alert('Pro feature', 'Transformation projections require ONE MORE Pro.');
        router.push('/(features)/upgrade');
        clearTranscript();
        setConfirmVisible(false);
        setParsed(null);
        return;
      }

      if (command.intent === 'transformation_query' || command.intent === 'transformation_progress') {
        speakVoiceConfirmation(
          {
            ...command,
            transformationVoiceLine:
              command.intent === 'transformation_progress'
                ? 'Opening your progress timeline'
                : 'Opening your transformation projection',
          },
          voiceSettings.voiceFeedback,
          units.weightLabel,
        );
        router.push('/(tabs)/progress');
        clearTranscript();
        setConfirmVisible(false);
        setParsed(null);
        return;
      }

      const targetBf = command.targetBodyFatPct ?? 12;
      const projection = await bodyService.runTransformation(user.id, targetBf);
      if (!projection.success) {
        Alert.alert('Transformation unavailable', projection.error);
        return;
      }
      const line = `At ${targetBf}% body fat, projected weight ${units.formatWeight(projection.data.projected.weightKg)}`;
      speakVoiceConfirmation(
        { ...command, transformationVoiceLine: line },
        voiceSettings.voiceFeedback,
        units.weightLabel,
      );
      Alert.alert(
        'Transformation Projection',
        `${projection.data.rationale}\n\nProjected: ${units.formatWeight(projection.data.projected.weightKg)} at ${projection.data.projected.bodyFatPct}% BF`,
      );
      clearTranscript();
      setConfirmVisible(false);
      setParsed(null);
      return;
    }

    const peakIntents = [
      'play_peak',
      'start_at_chorus',
      'sync_music_next_set',
      'sync_next_set',
      'use_pr_song',
      'resume_playlist',
      'next_hype_song',
    ] as const;
    if (command.intent && peakIntents.includes(command.intent as (typeof peakIntents)[number])) {
      if (!peakMusicAllowed) {
        Alert.alert('Pro feature', 'Peak Music Sync requires ONE MORE Pro.');
        router.push('/(features)/upgrade');
        clearTranscript();
        setConfirmVisible(false);
        setParsed(null);
        return;
      }
      const peakResult = await peakMusicService.handleVoicePeakCommand(user.id, command.intent, {
        restDurationMs: restSecondsRemaining != null ? restSecondsRemaining * 1000 : undefined,
      });
      if (peakResult.success) {
        void productAnalyticsService.trackPeakMusic(user.id, command.intent);
        await voiceCoachingService.speakLine(peakResult.data);
        Alert.alert('Peak Music', peakResult.data);
      } else {
        Alert.alert('Peak Music', peakResult.error);
      }
      clearTranscript();
      setConfirmVisible(false);
      setParsed(null);
      return;
    }

    if (command.intent === 'train_today_query' || command.intent === 'build_workout') {
      const rec = await workoutRecommendationService.getDaily(user.id);
      if (!rec.success) {
        Alert.alert('Recommendations unavailable', rec.error);
        return;
      }
      const enriched = {
        ...command,
        trainTodayVoiceLine: rec.data.voiceTrainTodayLine,
        buildWorkoutVoiceLine: rec.data.voiceBuildWorkoutLine,
      };
      speakVoiceConfirmation(enriched, voiceSettings.voiceFeedback, units.weightLabel);
      const today = rec.data.today;
      const exerciseSummary = today.workout
        ? today.workout.exercises.map((e) => `${e.name} ${e.sets}×${e.reps}`).join('\n')
        : today.voiceLine;
      Alert.alert(
        command.intent === 'build_workout' ? 'Your Workout' : 'Train Today',
        `${today.sessionLabel ?? (today.isRestDay ? 'Rest Day' : 'Session')}\n\n${exerciseSummary}\n\n${today.whySelected[0] ?? ''}`,
      );
      clearTranscript();
      setConfirmVisible(false);
      setParsed(null);
      return;
    }

    if (command.intent === 'feedback' || command.intent === 'adjust_weight') {
      if (command.targetWeight != null && lastLoggedSet) {
        const kg = normalizeVoiceWeightToKg(
          command.targetWeight,
          command.rawText,
          command.weightUnit ?? units.preferredWeightUnit,
        );
        await updateSet(lastLoggedSet.id, { weight: kg });
        speakVoiceConfirmation(command, voiceSettings.voiceFeedback, units.weightLabel);
        clearTranscript();
        setConfirmVisible(false);
        setParsed(null);
        return;
      }
      const coachNote =
        command.feedback === 'easy'
          ? 'Noted — consider increasing weight on your next set.'
          : command.feedback === 'hard'
            ? 'Noted — keep weight or reduce slightly next set.'
            : command.feedback === 'failed'
              ? `Noted — ${command.reps ?? 'missed'} reps. Consider reducing load.`
              : command.weightAdjustment === 'increase'
                ? 'Noted — increase weight on your next set.'
                : 'Noted — reduce weight on your next set.';
      Alert.alert('AI Coach', coachNote);
      clearTranscript();
      setConfirmVisible(false);
      setParsed(null);
      return;
    }

    let exerciseName = command.exercise ?? activeExerciseName;
    if (!exerciseName && session.exercises.length > 0) {
      const active = session.exercises.find((e) => e.isActive) ?? session.exercises[session.exercises.length - 1];
      exerciseName = active?.exercise?.name;
    }
    if (!exerciseName) {
      Alert.alert('Which exercise?', 'Say the exercise name or start logging from the active exercise.');
      return;
    }
    const workoutExerciseId = await addExerciseByName(exerciseName);
    if (!workoutExerciseId) {
      Alert.alert('Error', 'Could not add exercise.');
      return;
    }

    const activeExercise = session.exercises.find((e) => e.id === workoutExerciseId);
    const logged = await logSet({
      workoutExerciseId,
      weight:
        command.weight != null
          ? normalizeVoiceWeightToKg(command.weight, command.rawText, units.preferredWeightUnit)
          : activeExercise?.suggestedWeight,
      reps: command.reps ?? parseInt(String(activeExercise?.suggestedReps ?? '8').match(/\d+/)?.[0] ?? '8', 10),
    });

    if (logged) {
      void productAnalyticsService.trackVoiceLog(user.id, command.intent);
      setActiveExerciseName(exerciseName);
      if (logged.isPr) {
        Alert.alert(
          'New PR!',
          `${exerciseName}: ${formatWorkoutWeightForInput(logged.weight, units.preferredWeightUnit)} ${units.weightLabel} × ${logged.reps}`,
        );
      }
      speakVoiceConfirmation(command, voiceSettings.voiceFeedback, units.weightLabel);
      clearTranscript();
      setConfirmVisible(false);
      setParsed(null);
    }
  }

  async function handleManualLog(exerciseName: string, weight?: number, reps?: number) {
    if (!session || session.status === 'paused') return false;

    const workoutExerciseId = await addExerciseByName(exerciseName);
    if (!workoutExerciseId) {
      Alert.alert('Error', 'Could not add exercise.');
      return false;
    }

    const logged = await logSet({ workoutExerciseId, weight, reps });
    if (logged?.isPr) {
      Alert.alert(
        'New PR!',
        `${exerciseName}: ${formatWorkoutWeightForInput(logged.weight, units.preferredWeightUnit)} ${units.weightLabel} × ${logged.reps ?? reps}`,
      );
    }
    return !!logged;
  }

  async function handleQuickCorrection(id: string) {
    if (!lastLoggedSet) {
      Alert.alert('No recent set', 'Log a set first to use quick corrections.');
      return;
    }

    const weight = lastLoggedSet.weight ?? 0;
    const reps = lastLoggedSet.reps ?? 0;
    const step = weightStepKg(units.preferredWeightUnit);

    switch (id) {
      case 'weight-up':
        await updateSet(lastLoggedSet.id, { weight: weight + step });
        break;
      case 'weight-down':
        await updateSet(lastLoggedSet.id, { weight: Math.max(0, weight - step) });
        break;
      case 'reps-up':
        await updateSet(lastLoggedSet.id, { reps: reps + 1 });
        break;
      case 'reps-down':
        await updateSet(lastLoggedSet.id, { reps: Math.max(0, reps - 1) });
        break;
      default:
        break;
    }
  }

  async function onMicPress() {
    if (session?.status === 'paused') {
      Alert.alert('Workout paused', 'Resume the workout to log sets.');
      return;
    }
    await handleMicPress();
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
    const completed = await endSession();
    if (!completed || !user) return;

    void productAnalyticsService.trackWorkoutCompleted(user.id, completed.id);

    const coachResult = await coachActivationService.getPostWorkoutSummary(user.id, completed.id);
    const summary = coachResult.success ? coachResult.data : null;

    const body = summary
      ? `${summary.workoutSummary}\n\n${summary.recoveryRecommendation}\n\n${summary.nutritionRecommendation}\n\n${summary.progressionRecommendations[0] ?? ''}`
      : `Duration: ${Math.round((completed.durationSeconds ?? 0) / 60)} min · ${completed.totalSets ?? 0} sets`;

    Alert.alert(summary ? 'Workout Complete — AI Coach' : 'Workout complete', body, [
      { text: 'Done', style: 'cancel' },
      {
        text: 'Share',
        onPress: () => socialShareService.shareWorkoutRecap(completed),
      },
    ]);
  }

  function handleCancelWorkout() {
    Alert.alert('Cancel workout', 'Discard this session?', [
      { text: 'Keep going', style: 'cancel' },
      {
        text: 'Cancel workout',
        style: 'destructive',
        onPress: () => cancelSession(),
      },
    ]);
  }

  if (loading && !session) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={LiftFlowColors.accent} />
      </View>
    );
  }

  if (!session) {
    return (
      <ScreenContainer contentContainerStyle={styles.scrollContent}>
        <AppText variant="headline">Workout</AppText>
        <StartWorkoutPrompt
          user={user}
          locations={locations}
          selectedLocationId={selectedId}
          onSelectLocation={setSelectedId}
          locationsLoading={locationsLoading}
          loading={starting}
          nearbyMatch={nearby.nearestMatch}
          locationChecking={nearby.checking}
          onEnableLocation={
            nearby.detectionEnabled && nearby.permissionStatus !== 'granted'
              ? nearby.requestPermission
              : undefined
          }
          onStart={handleStartWorkout}
          onAddLocation={() => router.push('/(features)/training-profile')}
        />
      </ScreenContainer>
    );
  }

  const isPaused = session.status === 'paused';
  const restActive = restSecondsRemaining !== null && restSecondsRemaining > 0;
  const focusExercise =
    session.exercises.find((e) => e.exercise?.name === activeExerciseName) ??
    session.exercises.find((e) => e.isActive) ??
    session.exercises[session.exercises.length - 1];
  const focusExerciseSets =
    focusExercise?.sets.map((s) => ({
      weightKg: s.weight ?? 0,
      reps: s.reps ?? 0,
      setNumber: s.setNumber,
    })) ?? [];

  return (
    <View style={styles.root}>
      <ScreenContainer bottomInset={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View>
            <AppText variant="caption" color="accent">
              {isPaused ? 'Paused' : session.status === 'active' ? 'Active Session' : session.status}
            </AppText>
            <AppText variant="title">{session.name}</AppText>
          </View>
          <View style={styles.sessionMeta}>
            <AppText variant="footnote" color="textSecondary">
              {session.exercises.length} exercises · {session.totalSets ?? 0} sets
            </AppText>
            {session.totalVolume ? (
              <AppText variant="footnote" color="textSecondary">
                {(session.totalVolume / 1000).toFixed(1)}k volume
              </AppText>
            ) : null}
          </View>
        </View>

        <View style={styles.controlRow}>
          {isPaused ? (
            <PrimaryButton label="Resume" onPress={resumeSession} />
          ) : (
            <PrimaryButton label="Pause" onPress={pauseSession} variant="secondary" />
          )}
          <PrimaryButton label="Finish" onPress={handleFinishWorkout} variant="secondary" />
          <PrimaryButton label="Cancel" onPress={handleCancelWorkout} variant="secondary" />
        </View>

        <RestTimerSection
          secondsRemaining={restSecondsRemaining}
          recommendedSeconds={activeRestPeriod?.recommendedSeconds ?? DEFAULT_REST_SECONDS}
          isActive={restActive}
          onAdjust={adjustRestTimer}
          onSkip={skipRestTimer}
        />

        {user && focusExercise?.exercise?.id ? (
          <FeatureGate featureId="smart-progression">
            <SmartProgressionCard
              userId={user.id}
              exerciseId={focusExercise.exercise.id}
              exerciseName={focusExercise.exercise.name}
              sessionId={session.id}
              currentSessionSets={focusExerciseSets}
              recoveryScore={recoveryScore}
            />
          </FeatureGate>
        ) : null}

        <SectionHeader title="Manual Log" subtitle="Enter weight, reps, and exercise" />
        <ManualSetEntry
          exercises={session.exercises}
          onLogSet={handleManualLog}
          disabled={isPaused}
        />

        <SectionHeader title="Exercises" subtitle="Tap mic or manual log above" />

        {session.exercises.length === 0 ? (
          <AppText variant="body" color="textSecondary">
            Log your first set manually or say "Bench press 225 for 8".
          </AppText>
        ) : (
          session.exercises.map((exercise) => (
            <WorkoutCard
              key={exercise.id}
              exercise={exercise}
              onEditSet={(set, name) => {
                setEditSet(set);
                setEditExerciseName(name);
              }}
            />
          ))
        )}

        <SectionHeader title="Quick Corrections" />
        <QuickCorrectionButtons onPress={handleQuickCorrection} />

        <View style={styles.micSpacer} />
      </ScreenContainer>

      <View style={styles.micDock}>
        <MicrophoneButton
          onPress={onMicPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          isListening={isListening}
          disabled={isPaused}
          inputMode={voiceSettings.inputMode}
          interimTranscript={interimTranscript}
        />
      </View>

      <VoiceConfirmModal
        visible={confirmVisible}
        parsed={parsed}
        transcript={transcript}
        onConfirm={handleConfirm}
        onReject={handleReject}
      />

      <SetEditModal
        visible={editSet !== null}
        set={editSet}
        exerciseName={editExerciseName}
        onSave={async (setId, weight, reps) => {
          const updated = await updateSet(setId, { weight, reps });
          if (updated?.isPr) Alert.alert('New PR!', `${editExerciseName}: ${updated.weight} × ${updated.reps}`);
        }}
        onDelete={async (setId) => {
          await deleteSet(setId);
        }}
        onClose={() => setEditSet(null)}
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
    gap: Spacing.xs,
  },
  controlRow: {
    gap: Spacing.sm,
    marginBottom: Spacing.xxl,
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
