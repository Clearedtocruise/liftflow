import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { useAuth } from '@/hooks/useAuth';
import { useLocalCalendarDay } from '@/hooks/useLocalCalendarDay';
import { useTabataModePreference } from '@/hooks/useTabataModePreference';
import { useWorkoutLocations } from '@/hooks/useWorkoutLocations';
import { resolveActiveTrainingDay } from '@/lib/activeTrainingDay';
import { localDateString } from '@/lib/localDate';
import { startPlannedWorkout } from '@/lib/startPlannedWorkout';
import { getWeekRange } from '@/lib/weekPlan';
import { aiService } from '@/services/aiService';
import { trainingService } from '@/services/trainingService';
import { useWorkoutPlanDraft } from '@/state/workout/WorkoutPlanDraftContext';
import { useWorkoutSession } from '@/state/workout/WorkoutSessionContext';
import type { PlannedWorkout } from '@/types';

/** The next scheduled session after today, for the Up Next card. */
export type UpcomingWorkout = {
  when: string;
  name: string;
  focus?: string;
  workout: PlannedWorkout;
};

type TodayDashboardState = {
  todaysWorkout: PlannedWorkout | null;
  /** Every planned workout in the current week — needed to move/swap days from home. */
  weekWorkouts: PlannedWorkout[];
  /** Optimistic write-back so a move/swap shows immediately before the API returns. */
  setWeekWorkouts: (workouts: PlannedWorkout[]) => void;
  /**
   * Today's scheduled session when it is already finished. Distinct from `todaysWorkout` so the
   * home hero can congratulate instead of collapsing into a recovery day.
   */
  completedTodaysWorkout: PlannedWorkout | null;
  /**
   * Today's scheduled session when a workout is already underway (`active` / `paused`). Kept
   * separate from startable `todaysWorkout` so Continue does not look like a rest day.
   */
  inProgressTodaysWorkout: PlannedWorkout | null;
  upcomingWorkout: UpcomingWorkout | null;
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

/**
 * Labels the next session "Tomorrow" for the next day and by weekday beyond that, because
 * "in 3 days" is harder to act on than "Thursday".
 */
function describeUpcoming(
  next: PlannedWorkout,
  todayKey: string,
  timeZone?: string | null,
): UpcomingWorkout {
  const tomorrow = new Date(`${todayKey}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const when =
    next.scheduledDate === localDateString(tomorrow, timeZone)
      ? 'Tomorrow'
      : new Date(`${next.scheduledDate}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' });

  const groups = next.suggestedMuscleGroups ?? [];
  return {
    when,
    name: next.name,
    focus: groups.length > 0 ? `Focus: ${groups.slice(0, 3).join(' · ')}` : undefined,
    workout: next,
  };
}

/** Loads today's planned workout and provides start / generate actions for the home screen. */
export function useTodayDashboard(): TodayDashboardState {
  const { user } = useAuth();
  const today = useLocalCalendarDay(user?.timezone);
  const { tabataModeEnabled } = useTabataModePreference();
  const { locations, selectedId } = useWorkoutLocations(user?.id);
  const { startSessionFromPlanned, refreshSession } = useWorkoutSession();
  const { plannedWorkout, exercises, isDirty, setPlannedWorkout, setSessionPlan, markSaved } =
    useWorkoutPlanDraft();

  const [weekWorkouts, setWeekWorkouts] = useState<PlannedWorkout[]>([]);
  const [todaysWorkout, setTodaysWorkout] = useState<PlannedWorkout | null>(null);
  const [completedTodaysWorkout, setCompletedTodaysWorkout] = useState<PlannedWorkout | null>(null);
  const [inProgressTodaysWorkout, setInProgressTodaysWorkout] = useState<PlannedWorkout | null>(null);
  const [upcomingWorkout, setUpcomingWorkout] = useState<UpcomingWorkout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hasProgram, setHasProgram] = useState(true);
  const [starting, setStarting] = useState(false);
  const [generating, setGenerating] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setWeekWorkouts([]);
      setTodaysWorkout(null);
      setCompletedTodaysWorkout(null);
      setInProgressTodaysWorkout(null);
      setUpcomingWorkout(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { from, to } = getWeekRange(new Date(), user.timezone);
      const [result, nextResult] = await Promise.all([
        trainingService.getPlannedWorkouts(user.id, from, to),
        trainingService.getNextPlannedWorkout(user.id, today),
      ]);
      if (!result.success) {
        // A failed fetch used to render identically to a rest day, telling the user they had
        // nothing scheduled when the request simply never came back.
        setError(true);
        setWeekWorkouts([]);
        setTodaysWorkout(null);
        setCompletedTodaysWorkout(null);
        setInProgressTodaysWorkout(null);
        setUpcomingWorkout(null);
        return;
      }
      setError(false);
      setWeekWorkouts(result.data);
      setHasProgram(result.data.length > 0);
      const active = resolveActiveTrainingDay(result.data, {
        date: today,
        timeZone: user.timezone,
      });
      setTodaysWorkout(active.isStartableWorkoutDay ? active.workout : null);
      const scheduled = active.scheduledWorkout;
      const status = scheduled?.status ?? null;
      setCompletedTodaysWorkout(status === 'completed' ? scheduled : null);
      setInProgressTodaysWorkout(status === 'active' || status === 'paused' ? scheduled : null);
      setUpcomingWorkout(
        nextResult.success && nextResult.data
          ? describeUpcoming(nextResult.data, today, user.timezone)
          : null,
      );
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
    weekWorkouts,
    setWeekWorkouts,
    completedTodaysWorkout,
    inProgressTodaysWorkout,
    upcomingWorkout,
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
