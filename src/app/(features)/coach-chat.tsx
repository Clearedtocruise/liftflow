import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet } from 'react-native';

import { ConversationalCoachPanel } from '@/components/coaching/ConversationalCoachPanel';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { FeatureGate } from '@/components/subscription/PremiumGate';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

export default function CoachChatScreen() {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
    setRefreshing(false);
  }, []);

  if (!user) return null;

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={LiftFlowColors.accent} />
      }>
      <AppText variant="title">LiftFlow Coach</AppText>
      <AppText variant="body" color="textSecondary" style={styles.subtitle}>
        Ask about training, nutrition, fatigue, plateaus, and progression
      </AppText>

      <FeatureGate featureId="ai-coach">
        <ConversationalCoachPanel key={refreshKey} context="general" />
      </FeatureGate>

      <PrimaryButton label="Back" onPress={() => router.back()} variant="secondary" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginBottom: Spacing.lg },
});
