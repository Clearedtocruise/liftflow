import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { FeatureGate } from '@/components/subscription/PremiumGate';
import { AppText } from '@/components/ui/AppText';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useHealthSync } from '@/hooks/useHealthSync';
import { HEALTH_DATA_LABELS } from '@/integrations/healthConstants';
import { integrationService } from '@/services/integrationService';
import type { IntegrationConnection } from '@/types/integrations';

export default function HealthKitScreen() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const {
    status,
    permission,
    syncing,
    lastReport,
    error,
    supportedTypes,
    requestPermissions,
    sync,
    refreshStatus,
  } = useHealthSync({ userId: user?.id });

  const refreshConnections = useCallback(async () => {
    if (!user) return;
    const result = await integrationService.getConnections(user.id);
    if (result.success) setConnections(result.data);
  }, [user]);

  useEffect(() => {
    refreshConnections();
  }, [refreshConnections]);

  const healthAvailability =
    Platform.OS === 'ios' ? integrationService.getHealthKitAvailability() : integrationService.getHealthConnectAvailability();

  const watchAvailability = integrationService.getWatchAvailability();

  const isConnected = (provider: string) => connections.find((c) => c.provider === provider)?.isConnected ?? false;

  async function handleRequestPermissions() {
    const result = await requestPermissions();
    if (result === 'authorized') Alert.alert('Permissions', 'Apple Health access granted.');
    else if (result === 'denied') Alert.alert('Permissions', 'Apple Health access was denied. Enable in Settings → Health → ONE MORE.');
    else Alert.alert('Unavailable', status?.availabilityReason ?? 'Health data not available.');
  }

  async function handleHealthSync() {
    if (!user) return;
    const report = await sync(30);
    if (report) {
      Alert.alert(
        'Sync complete',
        `Saved ${report.synced} records (${report.inserted} new, ${report.updated} updated, ${report.conflicts} conflicts resolved). Types: ${report.dataTypes.join(', ') || 'none'}.`,
      );
      refreshConnections();
    } else if (error) {
      Alert.alert('Sync failed', error);
    }
  }

  async function handleStravaConnect() {
    if (!user) return;
    const result = await integrationService.connectStrava(user.id);
    if (!result.success) Alert.alert('Strava', result.error ?? 'Connection failed');
    else refreshConnections();
  }

  async function handleStravaSync() {
    if (!user) return;
    const result = await integrationService.syncStrava(user.id);
    if (result.success) Alert.alert('Strava', `Imported ${result.data.imported} activities.`);
    else Alert.alert('Strava sync failed', result.error ?? '');
    refreshConnections();
  }

  async function handleWatchSync() {
    const result = await integrationService.requestWatchSync();
    if (result.queued) Alert.alert('Watch', 'Sync requested from Apple Watch.');
    else Alert.alert('Watch unavailable', result.error ?? '');
  }

  return (
    <ScreenContainer>
      <AppText variant="title">Apple Health & Watch</AppText>
      <AppText variant="body" color="textSecondary" style={styles.subtitle}>
        Sync heart rate, HRV, sleep, workouts, steps, weight, and calories into ONE MORE recovery intelligence.
      </AppText>

      <SectionHeader title={Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect'} />
      <FeatureGate featureId="healthkit-sync">
      <Card style={styles.card}>
        <AppText variant="body">
          {healthAvailability.available
            ? 'Production sync with permission flow, conflict resolution, and deduplicated storage.'
            : healthAvailability.reason}
        </AppText>
        <AppText variant="caption" color="textSecondary">
          Connected: {isConnected(Platform.OS === 'ios' ? 'apple_healthkit' : 'google_fit') ? 'Yes' : 'No'}
          {status?.lastSyncAt ? ` · Last sync ${new Date(status.lastSyncAt).toLocaleString()}` : ''}
        </AppText>
        <AppText variant="caption" color="textTertiary">
          Permission: {permission}
        </AppText>

        <View style={styles.typeGrid}>
          {supportedTypes.map((type) => (
            <View key={type} style={styles.typeChip}>
              <AppText variant="caption">{HEALTH_DATA_LABELS[type as keyof typeof HEALTH_DATA_LABELS] ?? type}</AppText>
            </View>
          ))}
        </View>

        <PrimaryButton label="Request Health Permissions" onPress={handleRequestPermissions} variant="secondary" />
        <PrimaryButton label={syncing ? 'Syncing…' : 'Sync Health Data'} onPress={handleHealthSync} disabled={syncing} />
        {lastReport ? (
          <AppText variant="footnote" color="textSecondary">
            Last sync: {lastReport.synced} saved · {lastReport.skipped} skipped · {lastReport.conflicts}{' '}
            conflicts
            {'importedCardio' in lastReport && typeof lastReport.importedCardio === 'number'
              ? ` · ${lastReport.importedCardio} workouts imported to History`
              : ''}
          </AppText>
        ) : null}
      </Card>
      </FeatureGate>

      {Platform.OS === 'ios' ? (
        <>
          <SectionHeader title="Apple Watch Architecture" subtitle="Phone-side — native Watch app not deployed yet" />
          <Card style={styles.card}>
            <AppText variant="body">
              Workout detection, movement classification, and heart rate monitoring are wired on the phone. A future
              watchOS companion will stream {`workout_detection`}, {`heart_rate_sample`}, and {`movement_event`}{' '}
              messages via WatchConnectivity.
            </AppText>
            <AppText variant="caption" color="textSecondary">
              {watchAvailability.available ? 'WatchConnectivity module available.' : watchAvailability.reason}
            </AppText>
            <PrimaryButton label="Open Watch Workout Assistant" onPress={() => router.push('/(features)/apple-watch')} variant="secondary" />
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

      <PrimaryButton label="Refresh Status" onPress={() => { refreshStatus(); refreshConnections(); }} variant="secondary" />
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
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  typeChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});
