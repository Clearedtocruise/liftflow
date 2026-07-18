import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ErrorStateCard } from '@/components/layout/StateCard';
import { WorkoutDayOverviewScreen } from '@/components/workout/execution/WorkoutDayOverviewScreen';
import { LiftFlowColors } from '@/constants/theme';
import { pickDefaultLocation } from '@/constants/trainingProfile';
import { useAuth } from '@/hooks/useAuth';
import { useTabataModePreference } from '@/hooks/useTabataModePreference';
import { useWorkoutLocations } from '@/hooks/useWorkoutLocations';
import { profileFigureGender } from '@/lib/exerciseMuscleMap';
import {
    peekPlannedWorkoutHandoff,
    takePlannedWorkoutHandoff,
} from '@/lib/plannedWorkoutHandoff';
import { getWeekRange, isConditioningWorkout } from '@/lib/weekPlan';
import { exercisesForSessionStart, exercisesFromPlannedWorkout } from '@/lib/workoutPlan';
import type { ExerciseAlternativeOption } from '@/services/exerciseAdvisoryService';
import { trainingService } from '@/services/trainingService';
import { useWorkoutPlanDraft } from '@/state/workout/WorkoutPlanDraftContext';
import { useWorkoutSession } from '@/state/workout/WorkoutSessionContext';
import type { PlannedWorkout } from '@/types/training';

function paramValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function isUsablePlannedWorkout(workout: PlannedWorkout | null | undefined): workout is PlannedWorkout {
  return Boolean(workout && workout.status !== 'cancelled');
}

function resolveInitialWorkout(
  id: string | undefined,
  date: string | undefined,
  draftWorkout: PlannedWorkout | null,
): PlannedWorkout | null {
  const handoff = peekPlannedWorkoutHandoff();
  if (isUsablePlannedWorkout(handoff)) {
    if ((!id || handoff.id === id) && (!date || handoff.scheduledDate === date)) {
      return handoff;
    }
  }
  if (isUsablePlannedWorkout(draftWorkout)) {
    if ((id && draftWorkout.id === id) || (date && draftWorkout.scheduledDate === date)) {
      return draftWorkout;
    }
  }
  return null;
}

export default function WorkoutDayScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
    plannedWorkoutId?: string | string[];
    date?: string | string[];
  }>();
  const id = paramValue(params.plannedWorkoutId) ?? paramValue(params.id);
  const date = paramValue(params.date);
  const { user } = useAuth();
  const { tabataModeEnabled } = useTabataModePreference();
  const { exercises, plannedWorkout: draftWorkout, setPlannedWorkout, setExercises } = useWorkoutPlanDraft();
  const { startSessionFromPlanned, refreshSession } = useWorkoutSession();
  const { locations, selectedId } = useWorkoutLocations(user?.id);

  const initialWorkout = useMemo(
    () => resolveInitialWorkout(id, date, draftWorkout),
    // Only for first paint — loadWorkout owns subsequent updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [workout, setWorkout] = useState<PlannedWorkout | null>(initialWorkout);
  const [loading, setLoading] = useState(!initialWorkout);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const loadWorkout = useCallback(async () => {
    const handedOff = takePlannedWorkoutHandoff({
      ...(id ? { id } : {}),
      ...(date ? { date } : {}),
    });
    const seed =
      handedOff ??
      (isUsablePlannedWorkout(draftWorkout) &&
      ((id && draftWorkout.id === id) || (date && draftWorkout.scheduledDate === date))
        ? draftWorkout
        : null);

    if (seed) {
      setWorkout(seed);
      setPlannedWorkout(seed);
      setExercises(exercisesFromPlannedWorkout(seed));
      setLoading(false);
      setLoadError(null);
    }

    if (!user?.id) {
      if (!seed) {
        setLoadError('Sign in to open this workout');
        setWorkout(null);
      }
      setLoading(false);
      return;
    }

    if (!seed) {
      setLoading(true);
      setLoadError(null);
    }

    let resolved: PlannedWorkout | null = null;

    if (id) {
      const byId = await trainingService.getPlannedWorkoutById(id, user.id, user.timezone);
      if (byId.success && isUsablePlannedWorkout(byId.data)) {
        resolved = byId.data;
      }
    }

    if (!resolved && (date || id)) {
      const { from, to } = getWeekRange(new Date(), user.timezone);
      const week = await trainingService.getPlannedWorkouts(user.id, from, to, user.timezone);
      if (week.success) {
        resolved =
          week.data.find((row) => id && row.id === id && row.status !== 'cancelled') ??
          week.data.find((row) => date && row.scheduledDate === date && row.status !== 'cancelled') ??
          null;
      }
    }

    if (!resolved) {
      // Keep the seed on screen — never flash "not found" after a successful handoff.
      if (!seed) {
        setLoadError(id || date ? 'Workout not found' : 'Missing workout id');
        setWorkout(null);
      }
      setLoading(false);
      return;
    }

    setWorkout(resolved);
    setPlannedWorkout(resolved);
    setExercises(exercisesFromPlannedWorkout(resolved));
    setLoadError(null);
    setLoading(false);
  }, [user?.id, user?.timezone, id, date, draftWorkout, setPlannedWorkout, setExercises]);

  useEffect(() => {
    void loadWorkout();
  }, [loadWorkout]);

  const handleStart = useCallback(async () => {
    if (!user || !workout) return;
    const location = pickDefaultLocation(locations, selectedId);
    const sessionExercises = exercisesForSessionStart(
      workout,
      tabataModeEnabled && !isConditioningWorkout(workout),
    );
    setStarting(true);
    const started = await startSessionFromPlanned(workout.id, {
      name: workout.name,
      gymName: location?.name ?? user.primaryGymName ?? undefined,
      trainingLocation: location?.locationType ?? user.trainingLocation,
      workoutLocationId: location?.id,
      exercisePlan: sessionExercises,
    });
    if (started) {
      setExercises(sessionExercises);
      await refreshSession();
      router.replace('/(tabs)/workout');
    }
    setStarting(false);
  }, [user, workout, locations, selectedId, tabataModeEnabled, setExercises, startSessionFromPlanned, refreshSession]);

  const handleReplaceExercise = useCallback(
    async (index: number, option: ExerciseAlternativeOption) => {
      if (!workout || index < 0 || index >= exercises.length) return;
      const previousExercises = exercises;
      const nextExercises = exercises.map((exercise, exerciseIndex) =>
        exerciseIndex === index
          ? {
              ...exercise,
              id: `plan-${index}-${option.name.toLowerCase().replace(/\s+/g, '-')}`,
              name: option.name,
            }
          : exercise,
      );
      setExercises(nextExercises);
      try {
        const result = await trainingService.updatePlannedWorkoutExercises(
          workout.id,
          nextExercises,
          workout.metadata,
        );
        if (result.success) {
          setWorkout(result.data);
          setPlannedWorkout(result.data);
          setExercises(exercisesFromPlannedWorkout(result.data));
        } else {
          setExercises(previousExercises);
        }
      } catch {
        setExercises(previousExercises);
      }
    },
    [workout, exercises, setExercises, setPlannedWorkout],
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={LiftFlowColors.accent} />
      </View>
    );
  }

  if (loadError && !workout) {
    return (
      <ScreenContainer contentContainerStyle={styles.centeredContent}>
        <ErrorStateCard
          title="Could not load workout"
          message={loadError}
          onRetry={() => void loadWorkout()}
          onBack={() => router.replace('/(tabs)/workout')}
          backLabel="Back to weekly plan"
        />
      </ScreenContainer>
    );
  }

  if (!workout) {
    return (
      <ScreenContainer contentContainerStyle={styles.centeredContent}>
        <ErrorStateCard
          title="Workout not found"
          message="This workout may have been moved, completed, or removed from your plan."
          onBack={() => router.replace('/(tabs)/workout')}
          backLabel="Back to weekly plan"
        />
      </ScreenContainer>
    );
  }

  return (
    <WorkoutDayOverviewScreen
      workout={workout}
      exercises={exercises}
      userId={user?.id}
      goal={user?.fitnessGoals?.[0]}
      programType={user?.metadata?.coachActivation?.programType}
      availableEquipment={user?.availableEquipment}
      gender={profileFigureGender(user?.sex)}
      starting={starting}
      onStart={handleStart}
      onEdit={() => router.push('/(tabs)/workout/edit')}
      onBack={() => router.back()}
      onReplaceExercise={handleReplaceExercise}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LiftFlowColors.background,
  },
  centeredContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});
