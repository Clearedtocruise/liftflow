import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { aiService } from '@/services/aiService';
import type { AIRecommendation } from '@/types';

export default function CoachingScreen() {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const result = await aiService.getRecommendations(user.id);
    if (result.success) setRecommendations(result.data);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRefresh() {
    if (!user) return;
    setRefreshing(true);
    await aiService.refreshCoaching(user.id);
    load();
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={LiftFlowColors.accent} />
      </View>
    );
  }

  return (
    <ScreenContainer
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={LiftFlowColors.accent} />}>
      <View style={styles.header}>
        <AppText variant="title">AI Coaching</AppText>
        <AppText variant="body" color="textSecondary">
          Recovery, training, and nutrition guidance
        </AppText>
      </View>

      <PrimaryButton label="Refresh Recommendations" onPress={handleRefresh} variant="secondary" />

      <SectionHeader title="Recommendations" subtitle="Based on your training load" />

      {recommendations.length === 0 ? (
        <AppText variant="body" color="textSecondary">
          Complete a few workouts to unlock personalized coaching.
        </AppText>
      ) : (
        recommendations.map((rec) => (
          <Card key={rec.id} style={styles.recCard}>
            <AppText variant="caption" color="accent">
              {rec.recommendationType.replace('_', ' ')}
            </AppText>
            <AppText variant="bodyBold">{rec.title}</AppText>
            <AppText variant="body" color="textSecondary">
              {rec.description}
            </AppText>
            {rec.rationale ? (
              <AppText variant="footnote" color="textTertiary">
                {rec.rationale}
              </AppText>
            ) : null}
          </Card>
        ))
      )}
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
  header: {
    gap: Spacing.xs,
    marginBottom: Spacing.xxl,
  },
  recCard: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
});
