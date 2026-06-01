import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { ProPlanComparison } from '@/components/subscription/ProPlanComparison';
import { RestorePurchasesButton } from '@/components/subscription/RestorePurchasesButton';
import { AppText } from '@/components/ui/AppText';
import { SUBSCRIPTION } from '@/constants/subscription';
import { Spacing } from '@/constants/theme';
import { useSubscription } from '@/hooks/useSubscription';
import { subscriptionService } from '@/services/subscriptionService';

export default function SubscriptionScreen() {
  const { subscription, isPremium, isTrialing, loading, isNativePurchasesAvailable, isRevenueCatConfigured } =
    useSubscription();
  const [price, setPrice] = useState(SUBSCRIPTION.displayPrice);

  useEffect(() => {
    subscriptionService.getOfferings().then((result) => {
      if (result.success) setPrice(result.data.price);
    });
  }, []);

  return (
    <ScreenContainer scroll>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="title">{SUBSCRIPTION.planName}</AppText>
        <AppText variant="body" color="textSecondary">
          AI coaching, recovery & nutrition intelligence, smart progression, and integrations.
        </AppText>

        <Card style={styles.planCard}>
          <AppText variant="headline">{isPremium ? 'Active' : price + '/month'}</AppText>
          <AppText variant="caption" color="textSecondary">
            {loading
              ? 'Loading status…'
              : isPremium
                ? `${isTrialing ? 'Trial' : 'Subscribed'} · ${subscription?.status ?? 'active'}`
                : `Auto-renewing · ${SUBSCRIPTION.trialLabel} available`}
          </AppText>
          {!isRevenueCatConfigured ? (
            <AppText variant="footnote" color="restTimer">
              RevenueCat API key not set — purchases work on TestFlight builds with EAS secrets configured.
            </AppText>
          ) : null}
          {!isNativePurchasesAvailable ? (
            <AppText variant="footnote" color="textSecondary">
              In-app purchases require a dev client or TestFlight build (not Expo Go).
            </AppText>
          ) : null}
        </Card>

        <SectionHeader title="Plans" />
        <ProPlanComparison price={price} />

        {isPremium ? (
          <PrimaryButton label="Manage Subscription" onPress={() => router.push('/(features)/manage-subscription')} />
        ) : (
          <PrimaryButton label={`Upgrade — ${price}/mo`} onPress={() => router.push('/(features)/upgrade')} />
        )}

        <RestorePurchasesButton />

        <View style={styles.disclosure}>
          <SectionHeader title="Subscription Terms" />
          <AppText variant="caption" color="textSecondary" style={styles.legal}>
            • Payment charged to your {Platform.OS === 'ios' ? 'Apple ID' : 'Google Play'} account.{'\n'}
            • Renews automatically unless cancelled 24h before period end.{'\n'}
            • Product ID: {Platform.OS === 'ios' ? SUBSCRIPTION.appleProductId : SUBSCRIPTION.googleProductId}
          </AppText>
        </View>

        <View style={styles.links}>
          <PrimaryButton label="Terms of Service" onPress={() => router.push('/legal/terms')} variant="secondary" />
          <PrimaryButton label="Privacy Policy" onPress={() => router.push('/legal/privacy')} variant="secondary" />
          <PrimaryButton label="Subscription Terms" onPress={() => router.push('/legal/subscription-terms')} variant="secondary" />
        </View>

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
    gap: Spacing.sm,
  },
  disclosure: {
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  legal: {
    lineHeight: 20,
  },
  links: {
    gap: Spacing.sm,
  },
});
