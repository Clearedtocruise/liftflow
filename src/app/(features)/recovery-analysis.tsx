import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, View } from 'react-native';

import { EmptyStateCard, ErrorStateCard } from '@/components/layout/StateCard';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { RecoveryIntelligenceDashboard } from '@/components/recovery/RecoveryIntelligenceDashboard';
import { FeatureGate } from '@/components/subscription/PremiumGate';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useEntitlement } from '@/hooks/useEntitlement';
import { productAnalyticsService } from '@/services/productAnalyticsService';
import { recoveryService } from '@/services/recoveryService';
import type { RecoveryIntelligenceReport } from '@/types/recoveryIntelligence';

export default function RecoveryAnalysisScreen() {
  const { user } = useAuth();
  const { allowed } = useEntitlement('recovery-intelligence');
  const [report, setReport] = useState<RecoveryIntelligenceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !allowed) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const result = await recoveryService.getIntelligence(user.id);
    if (result.success) {
      setReport(result.data);
      setError(null);
      void productAnalyticsService.trackRecovery(user.id);
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
      <AppText variant="title">Recovery Intelligence</AppText>
      <AppText variant="body" color="textSecondary" style={styles.subtitle}>
        Recovery % combines check-in signals, training load, and muscle readiness (Readiness %)
      </AppText>

      <FeatureGate featureId="recovery-intelligence">
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={LiftFlowColors.accent} />
          </View>
        ) : error ? (
          <ErrorStateCard
            title="Could not load recovery intelligence"
            message={error}
            onRetry={() => {
              setLoading(true);
              void load();
            }}
          />
        ) : report ? (
          <RecoveryIntelligenceDashboard report={report} />
        ) : (
          <EmptyStateCard
            title="Complete a check-in first"
            message="Recovery Intelligence combines your daily check-in, training load, and muscle readiness into one score."
            actionLabel="Daily check-in"
            onAction={() => router.push('/(features)/recovery-check-in')}
          />
        )}
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
