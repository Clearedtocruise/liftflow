import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { AppText } from '@/components/ui/AppText';
import { SUBSCRIPTION } from '@/constants/subscription';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { subscriptionService } from '@/services/subscriptionService';

const MANAGE_URL =
  Platform.OS === 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions';

export default function SubscriptionScreen() {
  const { user } = useAuth();
  const { subscription, isPremium, loading, refresh } = useSubscription();
  const [price, setPrice] = useState<string>(SUBSCRIPTION.displayPrice);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    subscriptionService.getOfferings().then((result) => {
      if (result.success) setPrice(result.data.price);
    });
  }, []);

  const handlePurchase = useCallback(async () => {
    if (!user) return;
    setPurchasing(true);
    const result = await subscriptionService.purchasePremium(user.id);
    setPurchasing(false);
    if (result.success) {
      await refresh();
      Alert.alert('Welcome to Premium', 'Your subscription is now active.');
    } else {
      Alert.alert('Purchase failed', !result.success ? result.error : 'Try again or use Restore Purchases.');
    }
  }, [user, refresh]);

  const handleRestore = useCallback(async () => {
    if (!user) return;
    setPurchasing(true);
    const result = await subscriptionService.restorePurchases(user.id);
    setPurchasing(false);
    if (result.success && subscriptionService.isPremium(result.data)) {
      await refresh();
      Alert.alert('Restored', 'Your premium subscription has been restored.');
    } else {
      Alert.alert('No subscription found', !result.success ? result.error : 'Use the Apple ID that purchased LiftFlow Premium.');
    }
  }, [user, refresh]);

  const manageUrl = MANAGE_URL;

  return (
    <ScreenContainer scroll>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="title">LiftFlow Premium</AppText>
        <AppText variant="body" color="textSecondary" style={styles.subtitle}>
          AI coaching, meal plans, health sync, and advanced analytics.
        </AppText>

        <Card style={styles.planCard}>
          <AppText variant="headline">{price}/month</AppText>
          <AppText variant="caption" color="textSecondary">
            Auto-renewing subscription · Cancel anytime
          </AppText>
          <AppText variant="body" style={styles.status}>
            Status: {loading ? 'Loading…' : isPremium ? `Premium (${subscription?.status})` : 'Free'}
          </AppText>
        </Card>

        {!isPremium ? (
          <PrimaryButton label={purchasing ? 'Processing…' : `Subscribe — ${price}/month`} onPress={handlePurchase} disabled={purchasing} />
        ) : null}

        <PrimaryButton label="Restore Purchases" onPress={handleRestore} variant="secondary" disabled={purchasing} />

        <View style={styles.disclosure}>
          <SectionHeader title="Subscription Terms" />
          <AppText variant="caption" color="textSecondary" style={styles.legal}>
            • Payment charged to your {Platform.OS === 'ios' ? 'Apple ID' : 'Google Play'} account at confirmation.{'\n'}
            • Subscription renews automatically unless cancelled at least 24 hours before the end of the current period.{'\n'}
            • Your account is charged for renewal within 24 hours prior to the end of the current period.{'\n'}
            • Manage or cancel in {Platform.OS === 'ios' ? 'Settings → Apple ID → Subscriptions' : 'Google Play Subscriptions'}.{'\n'}
            • Product ID: {Platform.OS === 'ios' ? SUBSCRIPTION.appleProductId : SUBSCRIPTION.googleProductId}
          </AppText>
          <PrimaryButton label="Manage Subscription" onPress={() => Linking.openURL(manageUrl)} variant="secondary" />
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
  subtitle: {
    marginBottom: Spacing.md,
  },
  planCard: {
    gap: Spacing.sm,
  },
  status: {
    marginTop: Spacing.sm,
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
