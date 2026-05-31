import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { PRO_FEATURE_LABELS, SUBSCRIPTION, type ProFeatureId } from '@/constants/subscription';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { useEntitlement } from '@/hooks/useEntitlement';

type UpgradePromptProps = {
  featureId: ProFeatureId;
  compact?: boolean;
};

export function UpgradePrompt({ featureId, compact }: UpgradePromptProps) {
  const { allowed, loading } = useEntitlement(featureId);
  if (loading || allowed) return null;

  const label = PRO_FEATURE_LABELS[featureId];

  if (compact) {
    return (
      <Pressable style={styles.compact} onPress={() => router.push('/(features)/upgrade')}>
        <AppText variant="footnote" color="accent">
          Unlock {label} with {SUBSCRIPTION.planName} →
        </AppText>
      </Pressable>
    );
  }

  return (
    <Card style={styles.card}>
      <AppText variant="bodyBold">{label}</AppText>
      <AppText variant="footnote" color="textSecondary">
        Included with {SUBSCRIPTION.planName}. {SUBSCRIPTION.trialLabel} for new subscribers.
      </AppText>
      <Pressable style={styles.cta} onPress={() => router.push('/(features)/upgrade')}>
        <AppText variant="bodyBold" color="primary">
          Upgrade
        </AppText>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.sm,
    marginVertical: Spacing.md,
  },
  compact: {
    paddingVertical: Spacing.sm,
  },
  cta: {
    alignSelf: 'flex-start',
    backgroundColor: LiftFlowColors.primaryMuted,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    marginTop: Spacing.xs,
  },
});
