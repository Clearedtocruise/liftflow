import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, View } from 'react-native';

import { RecoveryIntelligenceDashboard } from '@/components/recovery/RecoveryIntelligenceDashboard';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { recoveryService } from '@/services/recoveryService';
import type { RecoveryIntelligenceReport } from '@/types/recoveryIntelligence';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

export default function RecoveryAnalysisScreen() {
  const { user } = useAuth();
  const [report, setReport] = useState<RecoveryIntelligenceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const result = await recoveryService.getIntelligence(user.id);
    if (result.success) {
      setReport(result.data);
      setError(null);
    } else {
      setError(result.error);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={LiftFlowColors.accent} />
      </View>
    );
  }

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={LiftFlowColors.accent} />
      }>
      <AppText variant="title">Recovery Intelligence</AppText>
      <AppText variant="body" color="textSecondary" style={styles.subtitle}>
        Readiness from training load, muscle fatigue, and your check-in signals
      </AppText>

      {error ? (
        <AppText variant="body" color="restTimer">
          {error}
        </AppText>
      ) : report ? (
        <RecoveryIntelligenceDashboard report={report} />
      ) : null}

      <PrimaryButton
        label="Daily Check-in"
        onPress={() => router.push('/(features)/recovery-check-in')}
        variant="secondary"
      />
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
  subtitle: { marginBottom: Spacing.xl },
});
