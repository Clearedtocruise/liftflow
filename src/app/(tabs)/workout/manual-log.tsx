import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { AppText } from '@/components/ui/AppText';
import { ManualSetEntry } from '@/components/workout/ManualSetEntry';
import { QuickCorrectionButtons } from '@/components/workout/QuickCorrectionButtons';
import { SetEditModal } from '@/components/workout/SetEditModal';
import { VoiceComingSoonBanner } from '@/components/workout/VoiceComingSoonBanner';
import { WorkoutCard } from '@/components/workout/WorkoutCard';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { buildWorkoutSessionName, pickDefaultLocation } from '@/constants/trainingProfile';
import { useAuth } from '@/hooks/useAuth';
import { useUnits } from '@/hooks/useUnits';
import { useWorkoutLocations } from '@/hooks/useWorkoutLocations';
import { formatWorkoutWeightForInput, weightStepKg } from '@/lib/unitConversion';
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
  const [editSet, setEditSet] = useState<WorkoutSet | null>(null);
  const [editExerciseName, setEditExerciseName] = useState('');

  useEffect(() => {
    if (session || isLoading || !user) return;

    void (async () => {
      setStarting(true);
      const location = pickDefaultLocation(locations, selectedId);
      await startSession({
        name: buildWorkoutSessionName(user, location),
        gymName: location?.name ?? user.primaryGymName ?? undefined,
        trainingLocation: location?.locationType ?? user.trainingLocation,
        workoutLocationId: location?.id,
      });
      setStarting(false);
    })();
  }, [session, isLoading, user, locations, selectedId, startSession]);

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

  if (isLoading || starting || !session) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={LiftFlowColors.accent} />
      </View>
    );
  }

  const isPaused = session.status === 'paused';

  return (
    <ScreenContainer contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <AppText variant="title">Manual Log</AppText>
        <PrimaryButton label="Back" variant="ghost" onPress={() => router.back()} />
      </View>

      <AppText variant="footnote" color="textSecondary">
        Fallback logging when you are not following today&apos;s planned workout.
      </AppText>

      <SectionHeader title="Log Set" subtitle="Enter weight, reps, and exercise name" />
      <ManualSetEntry exercises={session.exercises} onLogSet={handleManualLog} disabled={isPaused} />

      <VoiceComingSoonBanner />

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
