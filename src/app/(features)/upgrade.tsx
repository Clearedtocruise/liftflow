import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ProPlanComparison } from '@/components/subscription/ProPlanComparison';
import { RestorePurchasesButton } from '@/components/subscription/RestorePurchasesButton';
import { AppText } from '@/components/ui/AppText';
import { SUBSCRIPTION } from '@/constants/subscription';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { subscriptionService } from '@/services/subscriptionService';

export default function UpgradeScreen() {
  const { user } = useAuth();
  const { isPremium, isTrialing, refresh } = useSubscription();
  const [price, setPrice] = useState(SUBSCRIPTION.displayPrice);
  const [hasTrial, setHasTrial] = useState(SUBSCRIPTION.trialDays > 0);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    subscriptionService.getOfferings().then((result) => {
      if (result.success) {
        setPrice(result.data.price);
        setHasTrial(result.data.hasTrial);
      }
    });
  }, []);

  const handlePurchase = useCallback(async () => {
    if (!user) return;
    setPurchasing(true);
    const result = await subscriptionService.purchasePremium(user.id);
    setPurchasing(false);

    if (result.success) {
      await refresh();
      const trialing = result.data.status === 'trialing';
      Alert.alert(
        trialing ? 'Trial started' : `Welcome to ${SUBSCRIPTION.planName}`,
        trialing
          ? `Your ${SUBSCRIPTION.trialLabel} is active. Pro features are unlocked.`
          : 'Your subscription is active.',
      );
      router.replace('/(tabs)/coaching');
      return;
    }

    Alert.alert('Purchase failed', !result.success ? result.error : 'Try again or restore purchases.');
  }, [user, refresh]);

  if (isPremium) {
    return (
      <ScreenContainer scroll>
        <AppText variant="title">You&apos;re on {SUBSCRIPTION.planName}</AppText>
        <AppText variant="body" color="textSecondary">
          {isTrialing ? 'Trial active — all Pro features are unlocked.' : 'All Pro features are unlocked.'}
        </AppText>
        <PrimaryButton label="Manage Subscription" onPress={() => router.push('/(features)/manage-subscription')} />
        <PrimaryButton label="Back" onPress={() => router.back()} variant="secondary" />
      </ScreenContainer>
    );
  }

  const ctaLabel = hasTrial
    ? `Start ${SUBSCRIPTION.trialLabel}`
    : `Subscribe — ${price}/month`;

  return (
    <ScreenContainer scroll>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="title">Upgrade to {SUBSCRIPTION.planName}</AppText>
        <AppText variant="body" color="textSecondary">
          Unlock AI coaching, recovery and nutrition intelligence, smart progression, and more.
        </AppText>

        <Card style={styles.planCard}>
          <AppText variant="headline">{price}/month after trial</AppText>
          {hasTrial ? (
            <AppText variant="body" color="accent">
              {SUBSCRIPTION.trialLabel} · then {price}/month
            </AppText>
          ) : null}
          <ProPlanComparison price={price} showTrial={hasTrial} />
        </Card>

        <PrimaryButton label={purchasing ? 'Processing…' : ctaLabel} onPress={handlePurchase} disabled={purchasing} />
        <RestorePurchasesButton />

        <View style={styles.disclosure}>
          <AppText variant="caption" color="textSecondary">
            Payment charged to your {Platform.OS === 'ios' ? 'Apple ID' : 'Google Play'} account. Subscription renews
            automatically unless cancelled at least 24 hours before period end. Product ID:{' '}
            {Platform.OS === 'ios' ? SUBSCRIPTION.appleProductId : SUBSCRIPTION.googleProductId}
          </AppText>
        </View>

        <PrimaryButton label="Compare plans" onPress={() => router.push('/(features)/subscription')} variant="secondary" />
        <PrimaryButton label="Back" onPress={() => router.back()} variant="secondary" />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  planCard: {
    gap: Spacing.md,
  },
  disclosure: {
    marginTop: Spacing.sm,
  },
});
