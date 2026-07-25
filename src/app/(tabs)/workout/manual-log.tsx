import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ErrorStateCard } from '@/components/layout/StateCard';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { AppText } from '@/components/ui/AppText';
import { ManualSetEntry, type ManualSetLogPayload } from '@/components/workout/ManualSetEntry';
import { QuickCorrectionButtons } from '@/components/workout/QuickCorrectionButtons';
import { SetEditModal } from '@/components/workout/SetEditModal';
import { VoiceSetLogger } from '@/components/workout/VoiceSetLogger';
import { WorkoutCard } from '@/components/workout/WorkoutCard';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { buildWorkoutSessionName, pickDefaultLocation } from '@/constants/trainingProfile';
import { useAuth } from '@/hooks/useAuth';
import { useUnits } from '@/hooks/useUnits';
import { useWorkoutLocations } from '@/hooks/useWorkoutLocations';
import { formatWorkoutWeightForInput, adjustWeightKg } from '@/lib/unitConversion';
import { useWorkoutSession } from '@/state/workout/WorkoutSessionContext';
import type { WorkoutSet } from '@/types';

export default function ManualLogScreen() {
  const { user } = useAuth();
  const units = useUnits();
  const { locations, selectedId } = useWorkoutLocations(user?.id);
  const {
    activeSession: session,
    isLoading,
    startSession,
    logSet,
    updateSet,
    deleteSet,
    addExerciseByName,
    lastLoggedSet,
  } = useWorkoutSession();

  const [starting, setStarting] = useState(false);
  const [startFailed, setStartFailed] = useState(false);
  const [editSet, setEditSet] = useState<WorkoutSet | null>(null);
  const [editExerciseName, setEditExerciseName] = useState('');

  useEffect(() => {
    if (session || isLoading || !user || startFailed) return;

    void (async () => {
      setStarting(true);
      const location = pickDefaultLocation(locations, selectedId);
      try {
        const started = await startSession({
          name: buildWorkoutSessionName(user, location),
          gymName: location?.name ?? user.primaryGymName ?? undefined,
          trainingLocation: location?.locationType ?? user.trainingLocation,
          workoutLocationId: location?.id,
        });
        // A failed start left `session` null forever, so the screen sat on a spinner with no
        // explanation and no way to retry.
        if (!started) setStartFailed(true);
      } catch {
        setStartFailed(true);
      } finally {
        setStarting(false);
      }
    })();
  }, [session, isLoading, user, locations, selectedId, startSession, startFailed]);

  async function handleManualLog(payload: ManualSetLogPayload) {
    if (!session || session.status === 'paused') return false;

    const workoutExerciseId = await addExerciseByName(payload.exerciseName);
    if (!workoutExerciseId) {
      Alert.alert('Error', 'Could not add exercise.');
      return false;
    }

    const logged = await logSet({
      workoutExerciseId,
      weight: payload.weight,
      reps: payload.reps,
      durationSeconds: payload.durationSeconds,
      distanceMeters: payload.distanceMeters,
    });
    if (logged?.isPr && payload.weight != null && payload.reps != null) {
      Alert.alert(
        'New PR!',
        `${payload.exerciseName}: ${formatWorkoutWeightForInput(logged.weight, units.preferredWeightUnit)} ${units.weightLabel} × ${logged.reps ?? payload.reps}`,
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

    switch (id) {
      case 'weight-up':
        await updateSet(lastLoggedSet.id, { weight: adjustWeightKg(weight, units.preferredWeightUnit, 1) });
        break;
      case 'weight-down':
        await updateSet(lastLoggedSet.id, { weight: adjustWeightKg(weight, units.preferredWeightUnit, -1) });
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

  if (startFailed && !session) {
    return (
      <ScreenContainer contentContainerStyle={styles.content}>
        <ErrorStateCard
          title="Couldn't start logging"
          message="We couldn't start a workout session. Check your connection and try again."
          onRetry={() => setStartFailed(false)}
        />
      </ScreenContainer>
    );
  }

  if (isLoading || starting || !session) {
    return (
      <View style={styles.loading} accessible accessibilityLabel="Starting your workout">
        <ActivityIndicator size="large" color={LiftFlowColors.accent} />
      </View>
    );
  }

  const isPaused = session.status === 'paused';

  return (
    <ScreenContainer keyboardAvoiding contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <AppText variant="title">Quick Log</AppText>
        <PrimaryButton label="Back" variant="ghost" onPress={() => router.back()} />
      </View>

      <AppText variant="footnote" color="textSecondary">
        Log sets without following today&apos;s planned workout.
      </AppText>

      <SectionHeader title="Log Set" subtitle="Fields adapt to the exercise type" />
      <ManualSetEntry exercises={session.exercises} onLogSet={handleManualLog} disabled={isPaused} />

      <SectionHeader title="Voice Log" subtitle="Speak a set instead of typing it" />
      <VoiceSetLogger
        userId={user?.id}
        onLogSet={handleManualLog}
        activeExerciseName={session.exercises.at(-1)?.exercise?.name}
        lastWeightKg={lastLoggedSet?.weight ?? undefined}
        lastReps={lastLoggedSet?.reps ?? undefined}
        disabled={isPaused}
      />

      <SectionHeader title="Logged Exercises" />

      {session.exercises.length === 0 ? (
        <AppText variant="body" color="textSecondary">
          Log your first set above.
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
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LiftFlowColors.background,
  },
  content: {
    gap: Spacing.lg,
    paddingBottom: Spacing.huge,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
