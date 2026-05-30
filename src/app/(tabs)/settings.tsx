import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { ConfirmationModePicker, SettingsRow } from '@/components/settings/SettingsRow';
import { AppSymbol, SYMBOL_FALLBACKS } from '@/components/ui/AppSymbol';
import { AppText } from '@/components/ui/AppText';
import {
    isWorkoutLocationDetectionEnabled,
    PRIVACY_WORKOUT_LOCATION_DETECTION,
} from '@/constants/locationPreferences';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { getPrimaryGymLabel } from '@/constants/trainingProfile';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { deviceLocationService } from '@/services/deviceLocationService';
import { exportService } from '@/services/exportService';
import { userService } from '@/services/userService';
import type { ConfirmationMode } from '@/types/common';

export default function SettingsScreen() {
  const { user, signOut, refreshProfile, deleteAccount } = useAuth();
  const { isPremium } = useSubscription();
  const [confirmationMode, setConfirmationMode] = useState<ConfirmationMode>('smart');
  const [exporting, setExporting] = useState(false);
  const [locationDetection, setLocationDetection] = useState(true);
  const [locationPermission, setLocationPermission] = useState<string>('—');

  useEffect(() => {
    if (!user) return;
    userService.getPreferences(user.id).then((result) => {
      if (result.success) {
        setLocationDetection(isWorkoutLocationDetectionEnabled(result.data.privacySettings));
      }
    });
    deviceLocationService.getPermissionStatus().then((status) => {
      setLocationPermission(
        status === 'granted' ? 'Allowed' : status === 'denied' ? 'Denied' : status === 'unavailable' ? 'N/A' : 'Not set',
      );
    });
    if (user.confirmationMode) setConfirmationMode(user.confirmationMode);
  }, [user]);

  const toggleLocationDetection = useCallback(async () => {
    if (!user) return;
    const next = !locationDetection;
    setLocationDetection(next);
    const prefs = await userService.getPreferences(user.id);
    const current = prefs.success ? prefs.data.privacySettings ?? {} : {};
    await userService.updatePreferences(user.id, {
      privacySettings: { ...current, [PRIVACY_WORKOUT_LOCATION_DETECTION]: next },
    });
  }, [user, locationDetection]);

  const handleConfirmationChange = useCallback(
    async (mode: ConfirmationMode) => {
      setConfirmationMode(mode);
      if (!user) return;
      await userService.updateProfile(user.id, { confirmationMode: mode });
      refreshProfile();
    },
    [user, refreshProfile],
  );

  async function handleSignOut() {
    await signOut();
    router.replace('/(auth)/login');
  }

  async function handleDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your account and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
              router.replace('/(auth)/login');
            } catch (error) {
              Alert.alert('Error', error instanceof Error ? error.message : 'Could not delete account');
            }
          },
        },
      ],
    );
  }

  async function handleExport(contentType: 'workout' | 'progress_summary' | 'meal_plan', title: string) {
    if (!user) return;
    setExporting(true);
    const result = await exportService.downloadAndShare(user.id, {
      contentType,
      format: 'pdf',
      sourceEntityId: '',
      title,
    });
    setExporting(false);
    if (!result.success) Alert.alert('Export failed', result.error);
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <AppText variant="title">Settings</AppText>
        {user ? (
          <AppText variant="body" color="textSecondary">
            {user.displayName ?? user.email}
          </AppText>
        ) : null}
      </View>

      <SectionHeader title="Voice & Logging" />
      <ConfirmationModePicker value={confirmationMode} onChange={handleConfirmationChange} />

      <View style={styles.sectionGap}>
        <SectionHeader title="Location" subtitle="Detect when you arrive at a saved gym" />
      </View>
      <Card style={styles.group}>
        <SettingsRow
          label="Gym arrival detection"
          value={locationDetection ? 'On' : 'Off'}
          icon={
            <AppSymbol name="location.fill" fallback={SYMBOL_FALLBACKS['location.fill'] ?? '◎'} size={20} tintColor={LiftFlowColors.textSecondary} />
          }
          onPress={toggleLocationDetection}
        />
        <SettingsRow
          label="Device location access"
          value={locationPermission}
          icon={
            <AppSymbol name="location.circle.fill" fallback="◎" size={20} tintColor={LiftFlowColors.textSecondary} />
          }
          onPress={async () => {
            const result = await deviceLocationService.requestForegroundPermission();
            if (result.success) {
              setLocationPermission(result.data === 'granted' ? 'Allowed' : result.data === 'denied' ? 'Denied' : 'Not set');
            }
            if (result.success && result.data === 'denied') {
              Alert.alert(
                'Location denied',
                'Enable location for LiftFlow in your device Settings to auto-detect your gym.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Open Settings', onPress: () => deviceLocationService.openAppSettings() },
                ],
              );
            }
          }}
        />
        <SettingsRow
          label="Workout locations"
          value={user ? (getPrimaryGymLabel(user) ?? 'Add gyms') : 'Add gyms'}
          icon={
            <AppSymbol name="figure.strengthtraining.traditional" fallback={SYMBOL_FALLBACKS['figure.strengthtraining.traditional']} size={20} tintColor={LiftFlowColors.textSecondary} />
          }
          onPress={() => router.push('/(features)/training-profile')}
        />
      </Card>

      <View style={styles.sectionGap}>
        <SectionHeader title="Profile" />
      </View>
      <Card style={styles.group}>
        <SettingsRow
          label="Weight"
          value={user?.weightKg ? `${Math.round(user.weightKg * 2.20462)} lbs` : 'Not set'}
          icon={
            <AppSymbol name="figure.stand" fallback={SYMBOL_FALLBACKS['figure.stand']} size={20} tintColor={LiftFlowColors.textSecondary} />
          }
          onPress={() => router.push('/(tabs)/progress')}
        />
        <SettingsRow
          label="Training Experience"
          value={user?.trainingExperience ?? 'Beginner'}
          icon={
            <AppSymbol name="person.fill" fallback={SYMBOL_FALLBACKS['person.fill']} size={20} tintColor={LiftFlowColors.textSecondary} />
          }
          onPress={() => router.push('/(tabs)/coaching')}
        />
      </Card>

      <View style={styles.sectionGap}>
        <SectionHeader title="Export" />
      </View>
      <Card style={styles.group}>
        <SettingsRow
          label="Workout PDF"
          icon={
            <AppSymbol name="doc.text" fallback={SYMBOL_FALLBACKS['doc.text']} size={20} tintColor={LiftFlowColors.textSecondary} />
          }
          onPress={() => handleExport('workout', 'Workout Export')}
        />
        <SettingsRow
          label="Progress PDF"
          icon={
            <AppSymbol name="chart.line.uptrend.xyaxis" fallback={SYMBOL_FALLBACKS['chart.line.uptrend.xyaxis']} size={20} tintColor={LiftFlowColors.textSecondary} />
          }
          onPress={() => handleExport('progress_summary', 'Progress Export')}
        />
        <SettingsRow
          label="Nutrition PDF"
          icon={
            <AppSymbol name="leaf.fill" fallback={SYMBOL_FALLBACKS['leaf.fill']} size={20} tintColor={LiftFlowColors.textSecondary} />
          }
          onPress={() => handleExport('meal_plan', 'Nutrition Export')}
        />
      </Card>
      {exporting ? (
        <AppText variant="caption" color="textSecondary" align="center">
          Generating PDF…
        </AppText>
      ) : null}

      <View style={styles.sectionGap}>
        <SectionHeader title="Premium" />
      </View>
      <Card style={styles.group}>
        <SettingsRow
          label="Subscription"
          value={isPremium ? 'Premium' : 'Free'}
          icon={
            <AppSymbol name="creditcard.fill" fallback={SYMBOL_FALLBACKS['creditcard.fill']} size={20} tintColor={LiftFlowColors.textSecondary} />
          }
          onPress={() => router.push('/(features)/subscription')}
        />
      </Card>

      <View style={styles.sectionGap}>
        <SectionHeader title="Integrations" />
      </View>
      <Card style={styles.group}>
        <SettingsRow
          label="Health & Strava"
          value="Sync settings"
          icon={
            <AppSymbol name="heart.text.square.fill" fallback={SYMBOL_FALLBACKS['heart.text.square.fill']} size={20} tintColor={LiftFlowColors.textSecondary} />
          }
          onPress={() => router.push('/(features)/healthkit')}
        />
      </Card>

      <View style={styles.sectionGap}>
        <SectionHeader title="Legal & Support" />
      </View>
      <Card style={styles.group}>
        <SettingsRow
          label="Privacy Policy"
          icon={
            <AppSymbol name="hand.raised.fill" fallback={SYMBOL_FALLBACKS['hand.raised.fill']} size={20} tintColor={LiftFlowColors.textSecondary} />
          }
          onPress={() => router.push('/legal/privacy')}
        />
        <SettingsRow
          label="Terms of Service"
          icon={
            <AppSymbol name="doc.text" fallback={SYMBOL_FALLBACKS['doc.text']} size={20} tintColor={LiftFlowColors.textSecondary} />
          }
          onPress={() => router.push('/legal/terms')}
        />
        <SettingsRow
          label="Subscription Terms"
          icon={
            <AppSymbol name="creditcard.fill" fallback={SYMBOL_FALLBACKS['creditcard.fill']} size={20} tintColor={LiftFlowColors.textSecondary} />
          }
          onPress={() => router.push('/legal/subscription-terms')}
        />
        <SettingsRow
          label="Contact Support"
          icon={
            <AppSymbol name="envelope.fill" fallback={SYMBOL_FALLBACKS['envelope.fill']} size={20} tintColor={LiftFlowColors.textSecondary} />
          }
          onPress={() => router.push('/legal/support')}
        />
      </Card>

      <View style={styles.sectionGap}>
        <SectionHeader title="Account" />
      </View>
      <PrimaryButton label="Log Out" onPress={handleSignOut} variant="secondary" />
      <PrimaryButton label="Delete Account" onPress={handleDeleteAccount} variant="secondary" />

      <AppText variant="caption" color="textTertiary" style={styles.footer}>
        LiftFlow provides informational coaching only. Not medical advice. Exercise at your own risk.
      </AppText>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.xs,
    marginBottom: Spacing.xxl,
  },
  sectionGap: {
    marginTop: Spacing.xxl,
  },
  group: {
    gap: Spacing.xs,
  },
  footer: {
    marginTop: Spacing.xxxl,
    textAlign: 'center',
    lineHeight: 18,
  },
});
