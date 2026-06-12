import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

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

  const challenges = useMemo(() => {
    const fromParams = parseChallengesParam(challengesParam);
    if (fromParams.length > 0) return fromParams;
    return parseChallengeNotes(session?.notes);
  }, [challengesParam, session?.notes]);

  const load = useCallback(async () => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const sessionResult = await workoutService.getSession(sessionId);
    if (!sessionResult.success) {
      Alert.alert('Error', sessionResult.error);
      setLoading(false);
      return;
    }

    setSession(sessionResult.data);

    if (user?.id) {
      const coachResult = await coachActivationService.getPostWorkoutSummary(user.id, sessionId);
      if (coachResult.success) setCoachSummary(coachResult.data);
    }

    setLoading(false);
  }, [sessionId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || !session) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: LiftFlowColors.background }}>
        <ActivityIndicator size="large" color={LiftFlowColors.accent} />
      </View>
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
