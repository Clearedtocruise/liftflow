import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { SUBSCRIPTION } from '@/constants/subscription';
import { Spacing } from '@/constants/theme';
import { useSubscriptionContext } from '@/contexts/SubscriptionContext';

type PremiumGateProps = {
  children?: ReactNode;
  featureName?: string;
};

export function PremiumGate({ children, featureName = 'This feature' }: PremiumGateProps) {
  const { isPremium, loading } = useSubscriptionContext();

  if (loading) return null;
  if (isPremium && children) return <>{children}</>;
  if (isPremium) return null;

  return (
    <Card style={styles.card}>
      <AppText variant="headline">Premium Required</AppText>
      <AppText variant="body" color="textSecondary">
        {featureName} is included with LiftFlow Premium ({SUBSCRIPTION.displayPrice}/month).
      </AppText>
      <PrimaryButton label={`Upgrade — ${SUBSCRIPTION.displayPrice}/mo`} onPress={() => router.push('/(features)/subscription')} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.md,
    marginVertical: Spacing.lg,
  },
});
