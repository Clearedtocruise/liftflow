import { router } from 'expo-router';
import { Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { RestorePurchasesButton } from '@/components/subscription/RestorePurchasesButton';
import { AppText } from '@/components/ui/AppText';
import { SUBSCRIPTION } from '@/constants/subscription';
import { Spacing } from '@/constants/theme';
import { useSubscription } from '@/hooks/useSubscription';

const MANAGE_URL =
  Platform.OS === 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions';

export default function ManageSubscriptionScreen() {
  const { subscription, isPremium, isTrialing, loading } = useSubscription();

  return (
    <ScreenContainer scroll>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="title">Manage Subscription</AppText>

        <Card style={styles.card}>
          <AppText variant="label" color="textSecondary">
            Current plan
          </AppText>
          <AppText variant="headline">{loading ? 'Loading…' : isPremium ? SUBSCRIPTION.planName : 'Free'}</AppText>
          {isPremium ? (
            <>
              <AppText variant="body" color="textSecondary">
                Status: {isTrialing ? 'Trial' : subscription?.status ?? 'active'}
              </AppText>
              {subscription?.currentPeriodEnd ? (
                <AppText variant="footnote" color="textSecondary">
                  {isTrialing ? 'Trial ends' : 'Renews'}: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </AppText>
              ) : null}
            </>
          ) : (
            <AppText variant="body" color="textSecondary">
              Upgrade to unlock Pro features.
            </AppText>
          )}
        </Card>

        {isPremium ? (
          <>
            <SectionHeader title="Billing" />
            <PrimaryButton label="Open App Store Subscriptions" onPress={() => Linking.openURL(MANAGE_URL)} />
            <AppText variant="caption" color="textSecondary">
              Cancel or change your plan in {Platform.OS === 'ios' ? 'Apple ID Subscriptions' : 'Google Play'}.
            </AppText>
          </>
        ) : (
          <PrimaryButton label={`Upgrade to ${SUBSCRIPTION.planName}`} onPress={() => router.push('/(features)/upgrade')} />
        )}

        <RestorePurchasesButton />

        <View style={styles.links}>
          <PrimaryButton label="Subscription Terms" onPress={() => router.push('/legal/subscription-terms')} variant="secondary" />
          <PrimaryButton label="Back" onPress={() => router.back()} variant="secondary" />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  card: {
    gap: Spacing.sm,
  },
  links: {
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
});
