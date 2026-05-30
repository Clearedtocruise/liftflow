import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { AppText } from '@/components/ui/AppText';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { integrationService } from '@/services/integrationService';
import type { IntegrationConnection } from '@/types/integrations';

export default function HealthKitScreen() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    const result = await integrationService.getConnections(user.id);
    if (result.success) setConnections(result.data);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const healthAvailability =
    Platform.OS === 'ios' ? integrationService.getHealthKitAvailability() : integrationService.getHealthConnectAvailability();

  const watchAvailability = integrationService.getWatchAvailability();

  const isConnected = (provider: string) => connections.find((c) => c.provider === provider)?.isConnected ?? false;

  async function handleHealthSync() {
    if (!user) return;
    setSyncing(true);
    const result = await integrationService.syncHealth(user.id);
    setSyncing(false);
    if (result.success) {
      Alert.alert('Sync complete', `Imported ${result.data.synced} records (${result.data.dataTypes.join(', ') || 'none'}).`);
      refresh();
    } else {
      Alert.alert('Sync failed', result.error ?? 'Could not sync health data.');
    }
  }

  async function handleStravaConnect() {
    if (!user) return;
    const result = await integrationService.connectStrava(user.id);
    if (!result.success) Alert.alert('Strava', result.error ?? 'Connection failed');
    else refresh();
  }

  async function handleStravaSync() {
    if (!user) return;
    setSyncing(true);
    const result = await integrationService.syncStrava(user.id);
    setSyncing(false);
    if (result.success) Alert.alert('Strava', `Imported ${result.data.imported} activities.`);
    else Alert.alert('Strava sync failed', result.error ?? '');
    refresh();
  }

  async function handleWatchSync() {
    const result = await integrationService.requestWatchSync();
    if (result.queued) Alert.alert('Watch', 'Sync requested from Apple Watch.');
    else Alert.alert('Watch unavailable', result.error ?? '');
  }

  return (
    <ScreenContainer>
      <AppText variant="title">Integrations</AppText>
      <AppText variant="body" color="textSecondary" style={styles.subtitle}>
        Sync health data, workouts, and cardio from connected services.
      </AppText>

      <SectionHeader title={Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect'} />
      <Card style={styles.card}>
        <AppText variant="body">
          {healthAvailability.available
            ? 'Ready to sync steps, weight, calories, heart rate, workouts, distance, and exercise minutes.'
            : healthAvailability.reason}
        </AppText>
        <AppText variant="caption" color="textSecondary">
          Connected: {isConnected(Platform.OS === 'ios' ? 'apple_healthkit' : 'google_fit') ? 'Yes' : 'No'}
        </AppText>
        <PrimaryButton label={syncing ? 'Syncing…' : 'Sync Health Data'} onPress={handleHealthSync} disabled={syncing} />
      </Card>

      {Platform.OS === 'ios' ? (
        <>
          <SectionHeader title="Apple Watch Workout Assistant" />
          <PrimaryButton
            label="Open Watch Workout Assistant"
            onPress={() => router.push('/(features)/apple-watch')}
            variant="secondary"
          />
          <SectionHeader title="Apple Watch Sync" />
          <Card style={styles.card}>
            <AppText variant="body">
              {watchAvailability.available
                ? 'Sync workouts, heart rate, calories, steps, and active sessions from your Watch.'
                : watchAvailability.reason}
            </AppText>
            <PrimaryButton label="Request Watch Sync" onPress={handleWatchSync} variant="secondary" />
          </Card>
        </>
      ) : null}

      <SectionHeader title="Strava" />
      <Card style={styles.card}>
        <AppText variant="body">Import runs, rides, distance, calories, pace, and workout history.</AppText>
        <AppText variant="caption" color="textSecondary">
          Connected: {isConnected('strava') ? 'Yes' : 'No'}
        </AppText>
        <PrimaryButton label="Connect Strava" onPress={handleStravaConnect} variant="secondary" />
        <PrimaryButton label="Sync Strava Activities" onPress={handleStravaSync} disabled={syncing} />
      </Card>

      <PrimaryButton label="Back" onPress={() => router.back()} variant="secondary" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    marginBottom: Spacing.xl,
  },
  card: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
});
