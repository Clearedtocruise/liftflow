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
  /** True when the plan fetch failed — distinct from a genuine rest day. */
  error: boolean;
  /** True when the week returned zero planned workouts, i.e. no program exists yet. */
  hasProgram: boolean;
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
  const { plannedWorkout, exercises, isDirty, setPlannedWorkout, setSessionPlan, markSaved } =
    useWorkoutPlanDraft();

  const [todaysWorkout, setTodaysWorkout] = useState<PlannedWorkout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hasProgram, setHasProgram] = useState(true);
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
        // A failed fetch used to render identically to a rest day, telling the user they had
        // nothing scheduled when the request simply never came back.
        setError(true);
        setTodaysWorkout(null);
        return;
      }
      setError(false);
      setHasProgram(result.data.length > 0);
      const active = resolveActiveTrainingDay(result.data, {
        date: today,
        timeZone: user.timezone,
      });
      setTodaysWorkout(active.isStartableWorkoutDay ? active.workout : null);
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
      // The session is built from the planned workout in the database, so edits still sitting in
      // the draft have to be written before they can reach the session.
      let planned = todaysWorkout;
      if (isDirty && plannedWorkout?.id === todaysWorkout.id) {
        const saved = await trainingService.updatePlannedWorkoutExercises(
          todaysWorkout.id,
          exercises,
          todaysWorkout.metadata,
        );
        if (!saved.success) {
          Alert.alert('Could not save your changes', saved.error || 'Please try again.');
          return false;
        }
        planned = saved.data;
        setTodaysWorkout(planned);
        markSaved(planned);
      }

      const result = await startPlannedWorkout({
        user,
        planned,
        tabataModeEnabled,
        locations,
        selectedLocationId: selectedId,
        startSessionFromPlanned,
        refreshSession,
      });
      if (!result) return false;
      setPlannedWorkout(planned);
      setSessionPlan(result.sessionExercises);
      return true;
    } finally {
      setStarting(false);
    }
  }, [
    user,
    todaysWorkout,
    starting,
    exercises,
    isDirty,
    plannedWorkout?.id,
    tabataModeEnabled,
    locations,
    selectedId,
    startSessionFromPlanned,
    refreshSession,
    markSaved,
    setPlannedWorkout,
    setSessionPlan,
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
    error,
    hasProgram,
    starting,
    generating,
    refresh,
    startWorkout,
    generateWorkout,
  };
}
