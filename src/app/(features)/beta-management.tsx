import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TextInput, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { isFounderUser } from '@/lib/betaAccess';
import { betaManagementService, type BetaManagementUser } from '@/services/betaManagementService';

export default function BetaManagementScreen() {
  const { user } = useAuth();
  const { isPremium, hasUnrestrictedAccess } = useSubscription();
  const [users, setUsers] = useState<BetaManagementUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user || !isFounderUser(user)) {
      setLoading(false);
      return;
    }
    const result = await betaManagementService.listUsers();
    if (result.success) setUsers(result.data.users);
    else Alert.alert('Load failed', result.error);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  if (!user) {
    return (
      <ScreenContainer>
        <AppText variant="body">Sign in required.</AppText>
      </ScreenContainer>
    );
  }

  if (!isFounderUser(user)) {
    return (
      <ScreenContainer>
        <AppText variant="headline">Founder access required</AppText>
        <AppText variant="body" color="textSecondary">
          Beta management is limited to founder accounts.
        </AppText>
        <PrimaryButton label="Back" onPress={() => router.back()} variant="secondary" />
      </ScreenContainer>
    );
  }

  async function handleAdd() {
    if (!email.trim()) return;
    setBusy(true);
    const result = await betaManagementService.addBetaTester(email.trim());
    setBusy(false);
    if (result.success) {
      setEmail('');
      await load();
      Alert.alert('Beta tester added', result.data.email);
    } else {
      Alert.alert('Add failed', result.error);
    }
  }

  async function handleRemove(targetEmail: string) {
    Alert.alert('Remove beta access', `Remove beta access for ${targetEmail}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          const result = await betaManagementService.removeBetaTester(targetEmail);
          setBusy(false);
          if (result.success) await load();
          else Alert.alert('Remove failed', result.error);
        },
      },
    ]);
  }

  async function addBeta(targetEmail: string) {
    setBusy(true);
    const result = await betaManagementService.addBetaTester(targetEmail);
    setBusy(false);
    if (result.success) await load();
    else Alert.alert('Add failed', result.error);
  }

  return (
    <ScreenContainer>
      <AppText variant="headline">Beta Management</AppText>
      <AppText variant="body" color="textSecondary">
        Grant or revoke unrestricted premium access for testers. RevenueCat remains active for production users.
      </AppText>

      <Card style={styles.summary}>
        <AppText variant="label" color="accent">
          Your access
        </AppText>
        <AppText variant="body">Founder: {user.isFounder ? 'Yes' : 'No'}</AppText>
        <AppText variant="body">Beta tester: {user.isBetaTester ? 'Yes' : 'No'}</AppText>
        <AppText variant="body">Premium: {isPremium ? 'Yes' : 'No'}</AppText>
        <AppText variant="body">Unrestricted: {hasUnrestrictedAccess ? 'Yes' : 'No'}</AppText>
      </Card>

      <SectionHeader title="Add Beta Tester" subtitle="Email address" />
      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          placeholder="tester@example.com"
          placeholderTextColor={LiftFlowColors.textTertiary}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <PrimaryButton label="Add" onPress={handleAdd} loading={busy} />
      </View>

      <SectionHeader title="Users" subtitle={`${users.length} profiles`} />
      {loading ? (
        <ActivityIndicator color={LiftFlowColors.accent} />
      ) : (
        users.map((row) => (
          <Card key={row.id} style={styles.userRow}>
            <AppText variant="bodyBold">{row.email}</AppText>
            <AppText variant="footnote" color="textSecondary">
              Founder: {row.isFounder ? 'Yes' : 'No'} · Beta: {row.isBetaTester ? 'Yes' : 'No'} · Sub:{' '}
              {row.subscriptionTier}/{row.subscriptionStatus} · Premium: {row.isPremium ? 'Yes' : 'No'}
            </AppText>
            {!row.isFounder ? (
              row.isBetaTester ? (
                <PrimaryButton
                  label="Remove beta access"
                  variant="secondary"
                  onPress={() => handleRemove(row.email)}
                  disabled={busy}
                />
              ) : (
                <PrimaryButton
                  label="Add beta access"
                  onPress={() => void addBeta(row.email)}
                  disabled={busy}
                />
              )
            ) : null}
          </Card>
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  summary: {
    gap: Spacing.xs,
    marginVertical: Spacing.lg,
  },
  addRow: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  input: {
    backgroundColor: LiftFlowColors.background,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    color: LiftFlowColors.textPrimary,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  userRow: {
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
});
