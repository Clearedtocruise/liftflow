import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { FeatureGate } from '@/components/subscription/PremiumGate';
import { AppText } from '@/components/ui/AppText';
import { WorkoutRecommendationPanel } from '@/components/workout/WorkoutRecommendationPanel';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useEntitlement } from '@/hooks/useEntitlement';
import { workoutRecommendationService } from '@/services/workoutRecommendationService';
import type { WorkoutRecommendationReport } from '@/types/workoutRecommendation';
import { router } from 'expo-router';

export default function SuggestedWorkoutsScreen() {
  const { user } = useAuth();
  const { allowed } = useEntitlement('workout-recommendations');
  const [report, setReport] = useState<WorkoutRecommendationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !allowed) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const result = await workoutRecommendationService.getDaily(user.id);
    if (result.success) {
      setReport(result.data);
      setError(null);
    } else {
      setError(result.error);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user, allowed]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={LiftFlowColors.accent} />
      }>
      <AppText variant="title">Today&apos;s Workout</AppText>
      <AppText variant="body" color="textSecondary" style={styles.subtitle}>
        Personalized from recovery, history, goals, and adherence
      </AppText>

      <FeatureGate featureId="workout-recommendations">
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={LiftFlowColors.accent} />
          </View>
        ) : error ? (
          <AppText variant="body" color="restTimer">
            {error}
          </AppText>
        ) : report ? (
          <WorkoutRecommendationPanel report={report} />
        ) : null}
      </FeatureGate>

      <PrimaryButton label="Start Workout" onPress={() => router.push('/(tabs)/workout')} />
      <PrimaryButton label="Recovery Dashboard" onPress={() => router.push('/(features)/recovery-analysis')} variant="secondary" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LiftFlowColors.background,
    paddingVertical: Spacing.xxl,
  },
  subtitle: { marginBottom: Spacing.xl },
});
