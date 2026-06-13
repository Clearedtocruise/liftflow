import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { NutritionIntelligenceDashboard } from '@/components/nutrition/NutritionIntelligenceDashboard';
import { FeatureGate } from '@/components/subscription/PremiumGate';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useEntitlement } from '@/hooks/useEntitlement';
import { usePlanAdjustment } from '@/contexts/PlanAdjustmentContext';
import { nutritionIntelligenceService } from '@/services/nutritionIntelligenceService';
import { productAnalyticsService } from '@/services/productAnalyticsService';
import type { NutritionIntelligenceReport } from '@/types/nutritionIntelligence';

export default function NutritionIntelligenceScreen() {
  const { user } = useAuth();
  const { allowed } = useEntitlement('nutrition-intelligence');
  const { revision } = usePlanAdjustment();
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
      void productAnalyticsService.trackNutrition(user.id);
    } else {
      setError(result.error);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user, allowed]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (user && allowed) void load();
    }, [user, allowed, load]),
  );

  useEffect(() => {
    if (revision > 0 && user && allowed) void load();
  }, [revision, user, allowed, load]);

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
