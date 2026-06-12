import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { WorkoutExerciseList } from '@/components/workout/execution/WorkoutExerciseList';
import { StartWorkoutPrompt } from '@/components/workout/StartWorkoutPrompt';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { estimateWorkoutDurationMinutes } from '@/lib/workoutPlan';
import type { NearbyWorkoutLocationMatch } from '@/services/deviceLocationService';
import type { PlannedWorkout } from '@/types/training';
import type { UserProfile } from '@/types/user';
import type { EditableWorkoutExercise } from '@/types/workoutExecution';
import type { WorkoutLocation } from '@/types/workoutLocation';

type WorkoutOverviewScreenProps = {
  user: UserProfile | null;
  plannedWorkout: PlannedWorkout | null;
  exercises: EditableWorkoutExercise[];
  loadingPlan: boolean;
  starting: boolean;
  locations: WorkoutLocation[];
  selectedLocationId: string | null;
  onSelectLocation: (id: string) => void;
  locationsLoading?: boolean;
  nearbyMatch?: NearbyWorkoutLocationMatch | null;
  locationChecking?: boolean;
  onEnableLocation?: () => void;
  onStart: () => void;
  onEdit: () => void;
};

export function WorkoutOverviewScreen({
  user,
  plannedWorkout,
  exercises,
  loadingPlan,
  starting,
  locations,
  selectedLocationId,
  onSelectLocation,
  locationsLoading,
  nearbyMatch,
  locationChecking,
  onEnableLocation,
  onStart,
  onEdit,
}: WorkoutOverviewScreenProps) {
  const durationMin = estimateWorkoutDurationMinutes(exercises);

  return (
    <ScreenContainer contentContainerStyle={styles.content}>
      <AppText variant="headline">Workout</AppText>

      <StartWorkoutPrompt
        user={user}
        locations={locations}
        selectedLocationId={selectedLocationId}
        onSelectLocation={onSelectLocation}
        locationsLoading={locationsLoading}
        loading={false}
        nearbyMatch={nearbyMatch}
        locationChecking={locationChecking}
        onEnableLocation={onEnableLocation}
        onStart={() => undefined}
        hideStartButton
        onAddLocation={() => router.push('/(features)/training-profile')}
      />

      {loadingPlan ? (
        <View style={styles.loading}>
          <ActivityIndicator color={LiftFlowColors.accent} />
          <AppText variant="body" color="textSecondary">
            Loading today&apos;s workout…
          </AppText>
        </View>
      ) : plannedWorkout && exercises.length > 0 ? (
        <>
          <Card style={styles.summary} glow>
            <AppText variant="title">{plannedWorkout.name}</AppText>
            <View style={styles.metaRow}>
              <AppText variant="footnote" color="textSecondary">
                ~{durationMin} min
              </AppText>
              <AppText variant="footnote" color="textSecondary">
                {exercises.length} exercises
              </AppText>
            </View>
          </Card>

          <WorkoutExerciseList exercises={exercises} />

          <View style={styles.actions}>
            <PrimaryButton label={starting ? 'Starting…' : 'Start Workout'} size="large" loading={starting} onPress={onStart} />
            <PrimaryButton label="Edit Workout" variant="secondary" onPress={onEdit} />
          </View>
        </>
      ) : (
        <Card style={styles.empty}>
          <AppText variant="bodyBold">No workout scheduled today</AppText>
          <AppText variant="footnote" color="textSecondary">
            Pull to refresh on Home or start a manual session below.
          </AppText>
          <PrimaryButton label="Open Manual Log" variant="secondary" onPress={() => router.push('/(tabs)/workout/manual-log')} />
        </Card>
      )}

      <Pressable onPress={() => router.push('/(tabs)/workout/manual-log')} style={styles.manualLink}>
        <AppText variant="footnote" color="accent" align="center">
          Manual Log
        </AppText>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.lg,
    paddingBottom: Spacing.huge,
  },
  loading: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xxl,
  },
  summary: {
    gap: Spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  actions: {
    gap: Spacing.sm,
  },
  empty: {
    gap: Spacing.md,
  },
  manualLink: {
    paddingVertical: Spacing.md,
  },
});
