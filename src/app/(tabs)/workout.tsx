import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { FeatureGate } from '@/components/subscription/PremiumGate';
import { AppText } from '@/components/ui/AppText';
import { ManualSetEntry } from '@/components/workout/ManualSetEntry';
import { QuickCorrectionButtons } from '@/components/workout/QuickCorrectionButtons';
import { RestTimerSection } from '@/components/workout/RestTimerSection';
import { SetEditModal } from '@/components/workout/SetEditModal';
import { SmartProgressionCard } from '@/components/workout/SmartProgressionCard';
import { StartWorkoutPrompt } from '@/components/workout/StartWorkoutPrompt';
import { VoiceComingSoonBanner } from '@/components/workout/VoiceComingSoonBanner';
import { WorkoutCard } from '@/components/workout/WorkoutCard';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { buildWorkoutSessionName, pickDefaultLocation } from '@/constants/trainingProfile';
import { DEFAULT_REST_SECONDS } from '@/constants/workout';
import { useAuth } from '@/hooks/useAuth';
import { useNearbyWorkoutLocation } from '@/hooks/useNearbyWorkoutLocation';
import { useUnits } from '@/hooks/useUnits';
import { useWorkoutLocations } from '@/hooks/useWorkoutLocations';
import { formatWorkoutWeightForInput, weightStepKg } from '@/lib/unitConversion';
import { coachActivationService } from '@/services/coachActivationService';
import { productAnalyticsService } from '@/services/productAnalyticsService';
import { recoveryService } from '@/services/recoveryService';
import { socialShareService } from '@/services/socialShareService';
import { useWorkoutSession } from '@/state/workout/WorkoutSessionContext';
import type { WorkoutSet } from '@/types';

export default function WorkoutScreen() {
  const { user } = useAuth();
  const units = useUnits();
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

  const [starting, setStarting] = useState(false);
  const [editSet, setEditSet] = useState<WorkoutSet | null>(null);
  const [editExerciseName, setEditExerciseName] = useState('');
  const [activeExerciseName, setActiveExerciseName] = useState<string | undefined>();
  const [recoveryScore, setRecoveryScore] = useState<number | undefined>();

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

  async function handleManualLog(exerciseName: string, weight?: number, reps?: number) {
    if (!session || session.status === 'paused') return false;

    setActiveExerciseName(exerciseName);
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
        <ManualSetEntry exercises={session.exercises} onLogSet={handleManualLog} disabled={isPaused} />

        <VoiceComingSoonBanner />

        <SectionHeader title="Exercises" subtitle="Use manual log above" />

        {session.exercises.length === 0 ? (
          <AppText variant="body" color="textSecondary">
            Log your first set using manual entry above.
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
      </ScreenContainer>

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
});
