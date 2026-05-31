import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { PRO_FEATURE_LABELS, SUBSCRIPTION, type ProFeatureId } from '@/constants/subscription';
import { Spacing } from '@/constants/theme';
import { useEntitlement } from '@/hooks/useEntitlement';

type FeatureGateProps = {
  featureId: ProFeatureId;
  children?: ReactNode;
  /** Override display name */
  featureName?: string;
  /** When true, render nothing instead of paywall card if blocked */
  hidePaywall?: boolean;
  fallback?: ReactNode;
};

export function FeatureGate({ featureId, children, featureName, hidePaywall, fallback }: FeatureGateProps) {
  const { allowed, blocked, loading, isTrialing } = useEntitlement(featureId);
  const label = featureName ?? PRO_FEATURE_LABELS[featureId];

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  if (allowed && children) return <>{children}</>;
  if (allowed) return null;
  if (hidePaywall) return null;
  if (fallback) return <>{fallback}</>;

  return (
    <Card style={styles.card}>
      <AppText variant="headline">{SUBSCRIPTION.planName} Required</AppText>
      <AppText variant="body" color="textSecondary">
        {label} is included with {SUBSCRIPTION.planName}.
        {SUBSCRIPTION.trialDays > 0 ? ` Start your ${SUBSCRIPTION.trialLabel}.` : ''}
      </AppText>
      {isTrialing ? (
        <AppText variant="caption" color="accent">
          Trial active — refresh subscription status if access looks wrong.
        </AppText>
      ) : null}
      <PrimaryButton label={`Upgrade to ${SUBSCRIPTION.planName}`} onPress={() => router.push('/(features)/upgrade')} />
      <PrimaryButton label="View plans" onPress={() => router.push('/(features)/subscription')} variant="secondary" />
    </Card>
  );
}

/** @deprecated use FeatureGate with featureId */
export function PremiumGate({
  children,
  featureName = 'This feature',
}: {
  children?: ReactNode;
  featureName?: string;
}) {
  return (
    <FeatureGate featureId="ai-coach" featureName={featureName}>
      {children}
    </FeatureGate>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.md,
    marginVertical: Spacing.lg,
  },
  loading: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
});
