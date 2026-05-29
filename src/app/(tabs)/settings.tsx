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
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { exportService } from '@/services/exportService';
import { userService } from '@/services/userService';
import type { ConfirmationMode } from '@/types/common';

export default function SettingsScreen() {
  const { user, signOut, refreshProfile } = useAuth();
  const [confirmationMode, setConfirmationMode] = useState<ConfirmationMode>('smart');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!user) return;
    userService.getPreferences(user.id).then((result) => {
      if (result.success) {
        // confirmation mode lives on profile
      }
    });
    if (user.confirmationMode) setConfirmationMode(user.confirmationMode);
  }, [user]);

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
        <SectionHeader title="Account" />
      </View>
      <PrimaryButton label="Log Out" onPress={handleSignOut} variant="secondary" />

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
