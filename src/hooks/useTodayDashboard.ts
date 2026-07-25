import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { useAuth } from '@/hooks/useAuth';
import { useLocalCalendarDay } from '@/hooks/useLocalCalendarDay';
import { useTabataModePreference } from '@/hooks/useTabataModePreference';
import { useWorkoutLocations } from '@/hooks/useWorkoutLocations';
import { resolveActiveTrainingDay } from '@/lib/activeTrainingDay';
import { startPlannedWorkout } from '@/lib/startPlannedWorkout';
import { getWeekRange } from '@/lib/weekPlan';
import { aiService } from '@/services/aiService';
import { trainingService } from '@/services/trainingService';
import { useWorkoutPlanDraft } from '@/state/workout/WorkoutPlanDraftContext';
import { useWorkoutSession } from '@/state/workout/WorkoutSessionContext';
import type { PlannedWorkout } from '@/types';

type TodayDashboardState = {
  todaysWorkout: PlannedWorkout | null;
  loading: boolean;
  starting: boolean;
  generating: boolean;
  refresh: () => Promise<void>;
  startWorkout: () => Promise<boolean>;
  generateWorkout: () => Promise<boolean>;
};

/** Loads today's planned workout and provides start / generate actions for the home screen. */
export function useTodayDashboard(): TodayDashboardState {
  const { user } = useAuth();
  const today = useLocalCalendarDay(user?.timezone);
  const { tabataModeEnabled } = useTabataModePreference();
  const { locations, selectedId } = useWorkoutLocations(user?.id);
  const { startSessionFromPlanned, refreshSession } = useWorkoutSession();
  const { setPlannedWorkout, setExercises } = useWorkoutPlanDraft();

  const [todaysWorkout, setTodaysWorkout] = useState<PlannedWorkout | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [generating, setGenerating] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setTodaysWorkout(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { from, to } = getWeekRange(new Date(), user.timezone);
      const result = await trainingService.getPlannedWorkouts(user.id, from, to);
      if (!result.success) {
        setTodaysWorkout(null);
        return;
      }
      const active = resolveActiveTrainingDay(result.data, {
        date: today,
        timeZone: user.timezone,
      });
      setTodaysWorkout(active.workout);
    } finally {
      setLoading(false);
    }
  }, [user, today]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const startWorkout = useCallback(async () => {
    if (!user || !todaysWorkout || starting) return false;
    setStarting(true);
    try {
      const result = await startPlannedWorkout({
        user,
        planned: todaysWorkout,
        tabataModeEnabled,
        locations,
        selectedLocationId: selectedId,
        startSessionFromPlanned,
        refreshSession,
      });
      if (!result) return false;
      setPlannedWorkout(todaysWorkout);
      setExercises(result.sessionExercises);
      return true;
    } finally {
      setStarting(false);
    }
  }, [
    user,
    todaysWorkout,
    starting,
    tabataModeEnabled,
    locations,
    selectedId,
    startSessionFromPlanned,
    refreshSession,
    setPlannedWorkout,
    setExercises,
  ]);

  const generateWorkout = useCallback(async () => {
    if (!user || generating) return false;
    setGenerating(true);
    try {
      const result = await aiService.generateWorkoutPlan(user.id);
      if (!result.success) {
        Alert.alert('Could not generate workout', result.error || 'Please try again.');
        return false;
      }
      await refresh();
      return true;
    } catch (error) {
      Alert.alert(
        'Could not generate workout',
        error instanceof Error ? error.message : 'Please try again.',
      );
      return false;
    } finally {
      setGenerating(false);
    }
  }, [user, generating, refresh]);

  return {
    todaysWorkout,
    loading,
    starting,
    generating,
    refresh,
    startWorkout,
    generateWorkout,
  };
}
