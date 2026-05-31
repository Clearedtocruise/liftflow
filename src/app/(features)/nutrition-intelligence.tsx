import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, View } from 'react-native';
import { StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { NutritionIntelligenceDashboard } from '@/components/nutrition/NutritionIntelligenceDashboard';
import { FeatureGate } from '@/components/subscription/PremiumGate';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useEntitlement } from '@/hooks/useEntitlement';
import { nutritionIntelligenceService } from '@/services/nutritionIntelligenceService';
import type { NutritionIntelligenceReport } from '@/types/nutritionIntelligence';

export default function NutritionIntelligenceScreen() {
  const { user } = useAuth();
  const { allowed } = useEntitlement('nutrition-intelligence');
  const [report, setReport] = useState<NutritionIntelligenceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !allowed) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const result = await nutritionIntelligenceService.getIntelligence(user.id);
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
      <AppText variant="title">Nutrition Intelligence</AppText>
      <AppText variant="body" color="textSecondary" style={styles.subtitle}>
        Personalized macros, meals, and coaching from your goals, recovery, and training
      </AppText>

      <FeatureGate featureId="nutrition-intelligence">
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={LiftFlowColors.accent} />
          </View>
        ) : error ? (
          <AppText variant="body" color="restTimer">
            {error}
          </AppText>
        ) : report ? (
          <NutritionIntelligenceDashboard report={report} />
        ) : null}
      </FeatureGate>

      <PrimaryButton label="Back" onPress={() => router.back()} variant="secondary" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingVertical: Spacing.xxl,
    alignItems: 'center',
  },
  subtitle: { marginBottom: Spacing.lg },
});
