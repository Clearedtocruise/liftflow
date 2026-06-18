import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { ErrorStateCard } from '@/components/layout/StateCard';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { WorkoutSummaryScreen } from '@/components/workout/execution/WorkoutSummaryScreen';
import { LiftFlowColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { parseChallengeNotes } from '@/lib/workoutChallengeFlow';
import { coachActivationService } from '@/services/coachActivationService';
import { socialShareService } from '@/services/socialShareService';
import { workoutService } from '@/services/workoutService';
import type { WorkoutSession } from '@/types';
import type { PostWorkoutCoachSummary } from '@/types/coachActivation';
import type { WorkoutChallengeRecord } from '@/types/workoutChallenge';

function parseChallengesParam(raw?: string): WorkoutChallengeRecord[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as WorkoutChallengeRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function WorkoutSummaryRoute() {
  const { sessionId, challenges: challengesParam } = useLocalSearchParams<{
    sessionId?: string;
    challenges?: string;
  }>();
  const { user } = useAuth();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [coachSummary, setCoachSummary] = useState<PostWorkoutCoachSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const challenges = useMemo(() => {
    const fromParams = parseChallengesParam(challengesParam);
    if (fromParams.length > 0) return fromParams;
    return parseChallengeNotes(session?.notes);
  }, [challengesParam, session?.notes]);

  const load = useCallback(async () => {
    if (!sessionId) {
      setLoadError('No workout session was provided.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);

    const sessionResult = await workoutService.getSession(sessionId);
    if (!sessionResult.success) {
      setLoadError(sessionResult.error);
      setSession(null);
      setLoading(false);
      return;
    }

    setSession(sessionResult.data);

    if (user?.id) {
      const coachResult = await coachActivationService.getPostWorkoutSummary(user.id, sessionId);
      if (coachResult.success) setCoachSummary(coachResult.data);
      else setCoachSummary(null);
    }

    setLoading(false);
  }, [sessionId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: LiftFlowColors.background }}>
        <ActivityIndicator size="large" color={LiftFlowColors.accent} />
      </View>
    );
  }

  if (loadError || !session) {
    return (
      <ScreenContainer contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <ErrorStateCard
          title="Summary unavailable"
          message={loadError ?? 'This workout summary could not be loaded.'}
          onRetry={() => void load()}
          onBack={() => router.replace('/(tabs)/workout')}
          backLabel="Back to workouts"
        />
      </ScreenContainer>
    );
  }

  return (
    <WorkoutSummaryScreen
      session={session}
      coachSummary={coachSummary}
      challenges={challenges}
      onDone={() => router.replace('/(tabs)/workout')}
      onShare={() => {
        void socialShareService.shareWorkoutRecap(session);
      }}
    />
  );
}
