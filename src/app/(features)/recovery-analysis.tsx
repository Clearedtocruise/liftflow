import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, View } from 'react-native';
import { StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { RecoveryIntelligenceDashboard } from '@/components/recovery/RecoveryIntelligenceDashboard';
import { FeatureGate } from '@/components/subscription/PremiumGate';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useEntitlement } from '@/hooks/useEntitlement';
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
        Readiness from training load, muscle fatigue, and your check-in signals
      </AppText>

      <FeatureGate featureId="recovery-intelligence">
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={LiftFlowColors.accent} />
          </View>
        ) : error ? (
          <AppText variant="body" color="restTimer">
            {error}
          </AppText>
        ) : report ? (
          <RecoveryIntelligenceDashboard report={report} />
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
