import { useFocusEffect } from '@react-navigation/native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { TabScreenHeader } from '@/components/layout/TabScreenHeader';
import { AppearanceThemePicker } from '@/components/settings/AppearanceThemePicker';
import { ConfirmationModePicker, SettingsRow } from '@/components/settings/SettingsRow';
import { AppSymbol, SYMBOL_FALLBACKS } from '@/components/ui/AppSymbol';
import { AppText } from '@/components/ui/AppText';
import { HeroImages } from '@/constants/imagery';
import {
    isWorkoutLocationDetectionEnabled,
    PRIVACY_WORKOUT_LOCATION_DETECTION,
} from '@/constants/locationPreferences';
import { Brand, Spacing } from '@/constants/theme';
import type { AppTheme } from '@/constants/themes';
import { summarizeGoals } from '@/constants/trainingGoals';
import { getPrimaryGymLabel, summarizeEquipment } from '@/constants/trainingProfile';
import { summarizeUnitPreferences } from '@/constants/units';
import { usePlanAdjustment } from '@/contexts/PlanAdjustmentContext';
import { useThemeControl } from '@/contexts/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useLiftFlowTheme, useThemedStyles } from '@/hooks/useLiftFlowTheme';
import { useSubscription } from '@/hooks/useSubscription';
import { useUnits } from '@/hooks/useUnits';
import { loadRolloverValidationState, type RolloverValidationState } from '@/lib/rolloverDebug';
import { openSupportEmail } from '@/lib/supportMail';
import {
    isTabataModeEnabled,
    TABATA_MODE_PREF_KEY,
    tabataModeSummary,
} from '@/lib/trainingPreferences';
import { resolveDaysPerWeek, summarizeTrainingSchedule } from '@/lib/trainingSchedule';
import { resolveUnitPreferences } from '@/lib/unitConversion';
import { coachingPrefsPatch } from '@/lib/voice/voicePreferences';
import { dataResetService, formatResetConfirmation, type DataResetType } from '@/services/dataResetService';
import { deviceLocationService } from '@/services/deviceLocationService';
import { exportService } from '@/services/exportService';
import { feedbackService } from '@/services/feedbackService';
import { notificationService } from '@/services/notificationService';
import { userService } from '@/services/userService';
import { useWorkoutSession } from '@/state/workout/WorkoutSessionContext';
import type { ConfirmationMode } from '@/types/common';
import type { VoiceInputMode } from '@/types/voice';
import { useGymModeVoiceScope } from '@/voice/useGymModeVoiceScope';
import { useVoiceWorkout } from '@/voice/useVoiceWorkout';

export default function SettingsScreen() {
  const styles = useThemedStyles(createSettingsStyles);
  const { user, signOut, refreshProfile, deleteAccount } = useAuth();
  const { bumpRevision, dismiss } = usePlanAdjustment();
  const { themeId, setThemeId } = useThemeControl();
  const colors = useLiftFlowTheme();
  const { hydrate: hydrateWorkoutSession } = useWorkoutSession();
  const units = useUnits();
  const { isPremium, isFounder, isBetaTester } = useSubscription();
  const [confirmationMode, setConfirmationMode] = useState<ConfirmationMode>('smart');
  const [voiceAutoLog, setVoiceAutoLog] = useState(true);
  const [voiceFeedback, setVoiceFeedback] = useState(true);
  const [voiceInputMode, setVoiceInputMode] = useState<VoiceInputMode>('push_to_talk');
  const [heyOneMoreEnabled, setHeyOneMoreEnabled] = useState(false);
  const [gymModeEnabled, setGymModeEnabled] = useState(false);
  const { setWakePhraseSettingEnabled, setGymModeActive } = useVoiceWorkout();
  useGymModeVoiceScope(gymModeEnabled);
  const [exporting, setExporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [locationDetection, setLocationDetection] = useState(true);
  const [locationPermission, setLocationPermission] = useState<string>('—');
  const [tabataMode, setTabataMode] = useState(false);
  const [restTimerSound, setRestTimerSound] = useState(true);
  const [restTimerHaptics, setRestTimerHaptics] = useState(true);
  const [workoutReminderEnabled, setWorkoutReminderEnabled] = useState(false);
  const [validationState, setValidationState] = useState<RolloverValidationState | null>(null);

  const refreshValidationState = useCallback(async () => {
    if (!user) {
      setValidationState(null);
      return;
    }
    const state = await loadRolloverValidationState(user.id, user.timezone);
    setValidationState(state);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void refreshValidationState();
    }, [refreshValidationState]),
  );

  useEffect(() => {
    if (!user) return;
    userService.getPreferences(user.id).then((result) => {
      if (result.success) {
        setLocationDetection(isWorkoutLocationDetectionEnabled(result.data.privacySettings));
        setVoiceFeedback(result.data.voiceFeedback ?? true);
        const coaching = result.data.coachingPreferences ?? {};
        setVoiceAutoLog(coaching.voiceAutoLog !== false);
        const mode = coaching.voiceInputMode;
        if (mode === 'tap_toggle' || mode === 'continuous' || mode === 'push_to_talk') {
          setVoiceInputMode(mode);
        }
        setHeyOneMoreEnabled(coaching.wakePhraseEnabled === true);
        setGymModeEnabled(coaching.gymModeEnabled === true);
        setWakePhraseSettingEnabled(coaching.wakePhraseEnabled === true);
        setGymModeActive(coaching.gymModeEnabled === true);
        setTabataMode(isTabataModeEnabled(result.data));
        setRestTimerSound(result.data.restTimerSound !== false);
        setRestTimerHaptics(result.data.restTimerHaptics !== false);
        setWorkoutReminderEnabled(result.data.notificationPreferences?.workoutReminder === true);
      }
    });
    deviceLocationService.getPermissionStatus().then((status) => {
      setLocationPermission(
        status === 'granted' ? 'Allowed' : status === 'denied' ? 'Denied' : status === 'unavailable' ? 'N/A' : 'Not set',
      );
    });
    if (user.confirmationMode) setConfirmationMode(user.confirmationMode);
  }, [user, setGymModeActive, setWakePhraseSettingEnabled]);

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

  const saveVoiceInputMode = useCallback(
    async (mode: VoiceInputMode) => {
      setVoiceInputMode(mode);
      if (!user) return;
      const prefs = await userService.getPreferences(user.id);
      const coaching = prefs.success ? prefs.data.coachingPreferences ?? {} : {};
      await userService.updatePreferences(user.id, {
        coachingPreferences: { ...coaching, ...coachingPrefsPatch({ inputMode: mode }) },
      });
    },
    [user],
  );

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

  function confirmReset(type: DataResetType, label: string, detail: string) {
    if (!user) return;
    Alert.alert(
      label,
      `${detail}\n\nYour account, login, and subscription are kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => void runReset(type),
        },
      ],
    );
  }

  async function runReset(type: DataResetType) {
    if (!user) return;
    setResetting(true);
    const result = await dataResetService.resetData(user.id, type, user.timezone);
    await hydrateWorkoutSession();
    dismiss();
    bumpRevision();
    setResetting(false);
    await refreshValidationState();
    if (!result.success) {
      Alert.alert('Reset failed', result.error);
      return;
    }
    Alert.alert('Reset complete', formatResetConfirmation(result.data));
  }

  function handleResetWorkoutData() {
    confirmReset(
      'workout',
      'Reset Workout Data',
      'Deletes workout sessions, logged sets, weekly workout plans, moved/swapped days, and recovery history from workouts.',
    );
  }

  function handleResetNutritionData() {
    confirmReset(
      'nutrition',
      'Reset Nutrition Data',
      'Deletes nutrition logs, completed meals, meal replacements, weekly meal plans, and shopping lists.',
    );
  }

  function handleResetWorkoutAndNutritionData() {
    confirmReset(
      'both',
      'Reset Workout + Nutrition Data',
      'Deletes all workout and nutrition test data listed above.',
    );
  }

  function handleFullTestReset() {
    confirmReset(
      'full',
      'Full Test Reset',
      'Deletes all generated plans and logs, clears equipment profile, and keeps your login, profile basics, and access.',
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
    <ScreenContainer
      testID="settings-screen"
      header={
        <TabScreenHeader
          title="Settings"
          subtitle={user ? (user.displayName ?? user.email) : undefined}
          bannerUri={HeroImages.tabs.settings}
        />
      }>
      {isFounder || isBetaTester ? (
        <View style={styles.accessBadges}>
          {isFounder ? (
            <View style={styles.accessBadge}>
              <AppText variant="caption" color="accent">
                Founder
              </AppText>
            </View>
          ) : null}
          {isBetaTester ? (
            <View style={styles.accessBadge}>
              <AppText variant="caption" color="accent">
                Beta Tester
              </AppText>
            </View>
          ) : null}
        </View>
      ) : null}
      <SectionHeader title="Appearance" variant="secondary" />
      <AppearanceThemePicker value={themeId} onChange={(id) => void setThemeId(id)} />
      <SectionHeader title="Voice & Logging" variant="secondary" />
      <ConfirmationModePicker value={confirmationMode} onChange={handleConfirmationChange} />
      <Card style={styles.group}>
        <SettingsRow
          label="Auto-log high confidence"
          value={voiceAutoLog ? 'On' : 'Off'}
          onPress={async () => {
            if (!user) return;
            const next = !voiceAutoLog;
            setVoiceAutoLog(next);
            const prefs = await userService.getPreferences(user.id);
            const coaching = prefs.success ? prefs.data.coachingPreferences ?? {} : {};
            await userService.updatePreferences(user.id, {
              coachingPreferences: { ...coaching, voiceAutoLog: next },
            });
          }}
        />
        <SettingsRow
          label="Voice feedback (spoken)"
          value={voiceFeedback ? 'On' : 'Off'}
          onPress={async () => {
            if (!user) return;
            const next = !voiceFeedback;
            setVoiceFeedback(next);
            await userService.updatePreferences(user.id, { voiceFeedback: next });
          }}
        />
        <SettingsRow
          label="Mic input mode"
          value={
            voiceInputMode === 'push_to_talk'
              ? 'Push-to-talk'
              : voiceInputMode === 'continuous'
                ? 'Continuous'
                : 'Tap toggle'
          }
          onPress={() => {
            Alert.alert('Voice input mode', 'Choose how the workout microphone activates', [
              { text: 'Push-to-talk (default)', onPress: () => saveVoiceInputMode('push_to_talk') },
              { text: 'Tap toggle', onPress: () => saveVoiceInputMode('tap_toggle') },
              { text: 'Continuous', onPress: () => saveVoiceInputMode('continuous') },
              { text: 'Cancel', style: 'cancel' },
            ]);
          }}
        />
        <SettingsRow
          label="Enable Hey OneMore"
          value={heyOneMoreEnabled ? 'On' : 'Off'}
          onPress={async () => {
            if (!user) return;
            const next = !heyOneMoreEnabled;
            setHeyOneMoreEnabled(next);
            setWakePhraseSettingEnabled(next);
            const prefs = await userService.getPreferences(user.id);
            const coaching = prefs.success ? prefs.data.coachingPreferences ?? {} : {};
            await userService.updatePreferences(user.id, {
              coachingPreferences: { ...coaching, ...coachingPrefsPatch({ wakePhraseEnabled: next }) },
            });
          }}
        />
        <SettingsRow
          label="Gym Mode (wake word outside workout)"
          value={gymModeEnabled ? 'On' : 'Off'}
          onPress={async () => {
            if (!user) return;
            const next = !gymModeEnabled;
            setGymModeEnabled(next);
            setGymModeActive(next);
            const prefs = await userService.getPreferences(user.id);
            const coaching = prefs.success ? prefs.data.coachingPreferences ?? {} : {};
            await userService.updatePreferences(user.id, {
              coachingPreferences: { ...coaching, ...coachingPrefsPatch({ gymModeEnabled: next }) },
            });
          }}
        />
      </Card>

      <View style={styles.sectionGap}>
        <SectionHeader title="Rest Timer" subtitle="Alert when rest ends between sets" variant="secondary" />
      </View>
      <Card style={styles.group}>
        <SettingsRow
          label="Rest complete sound"
          value={restTimerSound ? 'On' : 'Off'}
          onPress={async () => {
            if (!user) return;
            const next = !restTimerSound;
            setRestTimerSound(next);
            await userService.updatePreferences(user.id, { restTimerSound: next });
          }}
        />
        <SettingsRow
          label="Rest complete vibration"
          value={restTimerHaptics ? 'On' : 'Off'}
          onPress={async () => {
            if (!user) return;
            const next = !restTimerHaptics;
            setRestTimerHaptics(next);
            await userService.updatePreferences(user.id, { restTimerHaptics: next });
          }}
        />
      </Card>

      <View style={styles.sectionGap}>
        <SectionHeader title="Notifications" subtitle="Opt in — we never spam" variant="secondary" />
      </View>
      <Card style={styles.group}>
        <SettingsRow
          label="Daily workout reminder"
          value={workoutReminderEnabled ? '6:00 PM' : 'Off'}
          icon={
            <AppSymbol name="bell.fill" fallback={SYMBOL_FALLBACKS['bell.fill']} size={20} tintColor={colors.textSecondary} />
          }
          onPress={async () => {
            if (!user) return;
            const next = !workoutReminderEnabled;
            if (next) {
              const perm = await notificationService.requestPermissions();
              if (!perm.success) {
                Alert.alert('Notifications off', 'Enable notifications in Settings to get a daily workout reminder.');
                return;
              }
            }
            setWorkoutReminderEnabled(next);
            const prefs = await userService.getPreferences(user.id);
            const notificationPreferences = prefs.success ? prefs.data.notificationPreferences ?? {} : {};
            await userService.updatePreferences(user.id, {
              notificationPreferences: { ...notificationPreferences, workoutReminder: next },
            });
            await notificationService.syncWorkoutReminder(next, 18, 0);
          }}
        />
      </Card>

      <View style={styles.sectionGap}>
        <SectionHeader
          title="Workout style"
          subtitle="Tabata only when enabled — work and rest timers adjustable 10–45s in workout"
          variant="secondary"
        />
      </View>
      <Card style={styles.group}>
        <SettingsRow
          label="Tabata mode"
          value={tabataMode ? `On · ${tabataModeSummary()}` : 'Off'}
          icon={
            <AppSymbol name="timer" fallback="⏱" size={20} tintColor={colors.textSecondary} />
          }
          onPress={async () => {
            if (!user) return;
            const next = !tabataMode;
            setTabataMode(next);
            const prefs = await userService.getPreferences(user.id);
            const coaching = prefs.success ? prefs.data.coachingPreferences ?? {} : {};
            await userService.updatePreferences(user.id, {
              coachingPreferences: { ...coaching, [TABATA_MODE_PREF_KEY]: next },
            });
          }}
        />
      </Card>

      <View style={styles.sectionGap}>
        <SectionHeader title="Gym & Location" subtitle="Arrival detection and saved gyms" variant="secondary" />
      </View>
      <Card style={styles.group}>
        <SettingsRow
          label="Gym arrival detection"
          value={locationDetection ? 'On' : 'Off'}
          icon={
            <AppSymbol name="location.fill" fallback={SYMBOL_FALLBACKS['location.fill'] ?? '◎'} size={20} tintColor={colors.textSecondary} />
          }
          onPress={toggleLocationDetection}
        />
        <SettingsRow
          label="Device location access"
          value={locationPermission}
          icon={
            <AppSymbol name="location.circle.fill" fallback="◎" size={20} tintColor={colors.textSecondary} />
          }
          onPress={async () => {
            const result = await deviceLocationService.requestForegroundPermission();
            if (result.success) {
              setLocationPermission(result.data === 'granted' ? 'Allowed' : result.data === 'denied' ? 'Denied' : 'Not set');
            }
            if (result.success && result.data === 'denied') {
              Alert.alert(
                'Location denied',
                'Enable location for ONE MORE in your device Settings to auto-detect your gym.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Open Settings', onPress: () => deviceLocationService.openAppSettings() },
                ],
              );
            }
          }}
        />
        <SettingsRow
          label="Workouts per week"
          value={user ? summarizeTrainingSchedule(resolveDaysPerWeek(user)) : 'Not set'}
          icon={
            <AppSymbol name="calendar" fallback="📅" size={20} tintColor={colors.textSecondary} />
          }
          onPress={() => router.push('/(features)/training-schedule')}
        />
        <SettingsRow
          label="Training goals"
          value={
            user?.fitnessGoals?.length
              ? summarizeGoals(user.fitnessGoals)
              : user?.primaryTrainingGoal
                ? summarizeGoals([user.primaryTrainingGoal])
                : 'Set goals'
          }
          icon={
            <AppSymbol name="target" fallback="🎯" size={20} tintColor={colors.textSecondary} />
          }
          onPress={() => router.push('/(features)/training-goals')}
        />
        <SettingsRow
          label="Units"
          value={user ? summarizeUnitPreferences(resolveUnitPreferences(user)) : 'Not set'}
          icon={
            <AppSymbol name="ruler.fill" fallback="📏" size={20} tintColor={colors.textSecondary} />
          }
          onPress={() => router.push('/(features)/unit-preferences')}
        />
        <SettingsRow
          label="Gym equipment"
          value={user?.availableEquipment?.length ? summarizeEquipment(user.availableEquipment) : 'Set up equipment'}
          icon={
            <AppSymbol name="dumbbell.fill" fallback="🏋" size={20} tintColor={colors.textSecondary} />
          }
          onPress={() => router.push('/(features)/equipment')}
        />
        <SettingsRow
          label="Nutrition preferences"
          value={
            user?.metadata?.coachProfile?.dietaryRestrictions?.length
              ? `${user.metadata.coachProfile.dietaryRestrictions.length} restriction(s)`
              : 'Allergies, diet, schedule'
          }
          icon={
            <AppSymbol name="leaf.fill" fallback="🥗" size={20} tintColor={colors.textSecondary} />
          }
          onPress={() => router.push('/(features)/nutrition-preferences')}
        />
        <SettingsRow
          label="Workout locations"
          value={user ? (getPrimaryGymLabel(user) ?? 'Add gyms') : 'Add gyms'}
          icon={
            <AppSymbol name="figure.strengthtraining.traditional" fallback={SYMBOL_FALLBACKS['figure.strengthtraining.traditional']} size={20} tintColor={colors.textSecondary} />
          }
          onPress={() => router.push('/(features)/training-profile')}
        />
      </Card>

      <View style={styles.sectionGap}>
        <SectionHeader title="Profile" variant="secondary" />
      </View>
      <Card style={styles.group}>
        <SettingsRow
          label="Weight"
          value={user?.weightKg ? units.formatWeight(user.weightKg) : 'Not set'}
          icon={
            <AppSymbol name="figure.stand" fallback={SYMBOL_FALLBACKS['figure.stand']} size={20} tintColor={colors.textSecondary} />
          }
          onPress={() => router.push('/(tabs)/progress')}
        />
        <SettingsRow
          label="AI Coaching Hub"
          value={`${user?.trainingExperience ?? 'Beginner'} · Recovery, training, nutrition`}
          icon={
            <AppSymbol name="person.fill" fallback={SYMBOL_FALLBACKS['person.fill']} size={20} tintColor={colors.textSecondary} />
          }
          onPress={() => router.push('/(tabs)/coaching')}
        />
        <SettingsRow
          label="Daily recovery check-in"
          icon={
            <AppSymbol name="heart.fill" fallback="♥" size={20} tintColor={colors.textSecondary} />
          }
          onPress={() => router.push('/(features)/recovery-check-in')}
        />
      </Card>

      <View style={styles.sectionGap}>
        <SectionHeader title="Export" variant="secondary" />
      </View>
      <Card style={styles.group}>
        <SettingsRow
          label="Workout PDF"
          icon={
            <AppSymbol name="doc.text" fallback={SYMBOL_FALLBACKS['doc.text']} size={20} tintColor={colors.textSecondary} />
          }
          onPress={() => handleExport('workout', 'Workout Export')}
        />
        <SettingsRow
          label="Progress PDF"
          icon={
            <AppSymbol name="chart.line.uptrend.xyaxis" fallback={SYMBOL_FALLBACKS['chart.line.uptrend.xyaxis']} size={20} tintColor={colors.textSecondary} />
          }
          onPress={() => handleExport('progress_summary', 'Progress Export')}
        />
        <SettingsRow
          label="Nutrition PDF"
          icon={
            <AppSymbol name="leaf.fill" fallback={SYMBOL_FALLBACKS['leaf.fill']} size={20} tintColor={colors.textSecondary} />
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
        <SectionHeader title="ONE MORE Pro" variant="secondary" />
      </View>
      <Card style={styles.group}>
        <SettingsRow
          label="Subscription"
          value={
            isPremium
              ? isFounder
                ? 'Pro · Founder'
                : isBetaTester
                  ? 'Pro · Beta'
                  : 'Pro'
              : 'Free'
          }
          icon={
            <AppSymbol name="creditcard.fill" fallback={SYMBOL_FALLBACKS['creditcard.fill']} size={20} tintColor={colors.textSecondary} />
          }
          onPress={() => router.push(isPremium ? '/(features)/manage-subscription' : '/(features)/upgrade')}
        />
        <SettingsRow
          label="Compare plans"
          value="Free vs Pro"
          icon={
            <AppSymbol name="sparkles" fallback={SYMBOL_FALLBACKS.sparkles} size={20} tintColor={colors.textSecondary} />
          }
          onPress={() => router.push('/(features)/subscription')}
        />
      </Card>

      <View style={styles.sectionGap}>
        <SectionHeader title="Integrations" variant="secondary" />
      </View>
      <Card style={styles.group}>
        <SettingsRow
          label="Health & Strava"
          value="Sync settings"
          icon={
            <AppSymbol name="heart.text.square.fill" fallback={SYMBOL_FALLBACKS['heart.text.square.fill']} size={20} tintColor={colors.textSecondary} />
          }
          onPress={() => router.push('/(features)/healthkit')}
        />
      </Card>

      <View style={styles.sectionGap}>
        <SectionHeader title="Legal & Support" variant="secondary" />
      </View>
      <Card style={styles.group}>
        <SettingsRow
          label="Privacy Policy"
          icon={
            <AppSymbol name="hand.raised.fill" fallback={SYMBOL_FALLBACKS['hand.raised.fill']} size={20} tintColor={colors.textSecondary} />
          }
          onPress={() => router.push('/legal/privacy')}
        />
        <SettingsRow
          label="Terms of Service"
          icon={
            <AppSymbol name="doc.text" fallback={SYMBOL_FALLBACKS['doc.text']} size={20} tintColor={colors.textSecondary} />
          }
          onPress={() => router.push('/legal/terms')}
        />
        <SettingsRow
          label="Subscription Terms"
          icon={
            <AppSymbol name="creditcard.fill" fallback={SYMBOL_FALLBACKS['creditcard.fill']} size={20} tintColor={colors.textSecondary} />
          }
          onPress={() => router.push('/legal/subscription-terms')}
        />
        <SettingsRow
          label="Contact Support"
          icon={
            <AppSymbol name="envelope.fill" fallback={SYMBOL_FALLBACKS['envelope.fill']} size={20} tintColor={colors.textSecondary} />
          }
          onPress={async () => {
            const opened = await openSupportEmail('ONE MORE Support');
            if (!opened) router.push('/legal/support');
          }}
        />
        <SettingsRow
          label="Report a bug"
          onPress={() => router.push('/(features)/send-feedback?type=bug')}
        />
        <SettingsRow
          label="Something confused me"
          onPress={() => router.push('/(features)/send-feedback?type=confusion')}
        />
        <SettingsRow
          label="Request a feature"
          onPress={() => router.push('/(features)/send-feedback?type=feature')}
        />
        <SettingsRow
          label="Release notes"
          onPress={() => router.push('/(features)/release-notes')}
        />
      </Card>

      <View style={styles.sectionGap}>
        <SectionHeader title="Beta" subtitle="Closed beta program" variant="secondary" />
      </View>
      <Card style={styles.group}>
        <BetaInviteRow userId={user?.id} isBetaTester={isBetaTester} onRedeemed={refreshProfile} />
      </Card>

      {__DEV__ ? (
        <>
          <View style={styles.sectionGap}>
            <SectionHeader title="Validation" subtitle="Current app state for testing" variant="secondary" />
          </View>
          <Card style={styles.group}>
            <ValidationDebugPanel state={validationState} onRefresh={refreshValidationState} />
          </Card>
        </>
      ) : null}

      {isFounder ? (
        <Card style={styles.group}>
          <SettingsRow
            label="QA Checklist"
            value="Founder device verification"
            icon={<AppSymbol name="checklist" fallback="✓" size={20} tintColor={colors.textSecondary} />}
            onPress={() => router.push('/(features)/qa-checklist')}
          />
        </Card>
      ) : null}
      <View style={styles.sectionGap}>
        <SectionHeader title="Account" variant="secondary" />
      </View>
      <Card style={styles.group} testID="settings-reset-button">
        <SettingsRow
          label="Reset Workout Data"
          value={resetting ? 'Resetting…' : undefined}
          icon={
            <AppSymbol name="arrow.counterclockwise" fallback="↺" size={20} tintColor={colors.textSecondary} />
          }
          onPress={resetting ? undefined : handleResetWorkoutData}
          testID="reset-workouts-button"
        />
        <SettingsRow
          label="Reset Nutrition Data"
          value={resetting ? 'Resetting…' : undefined}
          icon={
            <AppSymbol name="arrow.counterclockwise" fallback="↺" size={20} tintColor={colors.textSecondary} />
          }
          onPress={resetting ? undefined : handleResetNutritionData}
          testID="reset-nutrition-button"
        />
        <SettingsRow
          label="Reset Workout + Nutrition"
          value={resetting ? 'Resetting…' : undefined}
          icon={
            <AppSymbol name="arrow.counterclockwise" fallback="↺" size={20} tintColor={colors.textSecondary} />
          }
          onPress={resetting ? undefined : handleResetWorkoutAndNutritionData}
          testID="reset-all-button"
        />
        <SettingsRow
          label="Full Test Reset"
          value={resetting ? 'Resetting…' : 'Includes equipment'}
          icon={
            <AppSymbol name="arrow.counterclockwise" fallback="↺" size={20} tintColor={colors.textSecondary} />
          }
          onPress={resetting ? undefined : handleFullTestReset}
        />
      </Card>
      <PrimaryButton label="Log Out" onPress={handleSignOut} variant="secondary" />
      <PrimaryButton label="Delete Account" onPress={handleDeleteAccount} variant="destructive" />

      <AppText variant="caption" color="textTertiary" style={styles.footer}>
        ONE MORE provides informational coaching only. Not medical advice. Exercise at your own risk.
      </AppText>

      <View style={styles.aboutBlock}>
        <AppText variant="bodyBold" align="center">
          {Brand.name}
        </AppText>
        <AppText variant="caption" color="textSecondary" align="center">
          Version {Constants.expoConfig?.version ?? '1.0.0'}
        </AppText>
        <AppText variant="label" color="accent" align="center" style={styles.aboutTagline}>
          {Brand.taglinePrimary}
        </AppText>
      </View>
    </ScreenContainer>
  );
}

function formatDebugTimestamp(value: string | null): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function ValidationDebugPanel({
  state,
  onRefresh,
}: {
  state: RolloverValidationState | null;
  onRefresh: () => void;
}) {
  const styles = useThemedStyles(createSettingsStyles);

  if (!state) {
    return (
      <View style={styles.validationPanel}>
        <AppText variant="footnote" color="textSecondary">
          Loading validation state…
        </AppText>
      </View>
    );
  }

  const rows: [string, string][] = [
    ['Current local date', state.currentLocalDate],
    ['Current training day', state.currentTrainingDay],
    ['Current workout week', state.currentWorkoutWeek],
    ['Current nutrition week', state.currentNutritionWeek],
    ['Training week #', state.trainingWeekNumber != null ? String(state.trainingWeekNumber) : '—'],
    ['Active workout plan ID', state.activeWorkoutPlanId ?? '—'],
    ['Active nutrition plan ID', state.activeNutritionPlanId ?? '—'],
    ['Last reset time', formatDebugTimestamp(state.lastResetTime)],
    ['Last daily rollover', formatDebugTimestamp(state.lastDailyRollover)],
    ['Last weekly rollover', formatDebugTimestamp(state.lastWeeklyRollover)],
  ];

  return (
    <View style={styles.validationPanel}>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.validationRow}>
          <AppText variant="caption" color="textTertiary">
            {label}
          </AppText>
          <AppText variant="footnote" color="textSecondary" style={styles.validationValue}>
            {value}
          </AppText>
        </View>
      ))}
      <PrimaryButton label="Refresh validation" onPress={onRefresh} variant="secondary" />
    </View>
  );
}

function BetaInviteRow({
  userId,
  isBetaTester,
  onRedeemed,
}: {
  userId?: string;
  isBetaTester: boolean;
  onRedeemed: () => Promise<void>;
}) {
  const styles = useThemedStyles(createSettingsStyles);
  const colors = useLiftFlowTheme();
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  async function redeem() {
    if (!userId || !code.trim()) {
      Alert.alert('Enter code', 'Paste your beta invite code.');
      return;
    }
    const result = await feedbackService.redeemInvite(userId, code.trim());
    if (result.success) {
      setStatus(`Redeemed: ${result.data.label ?? result.data.code}`);
      await onRedeemed();
      Alert.alert('Welcome to the beta', 'Your tester access is active.');
    } else {
      Alert.alert('Invalid code', result.error);
    }
  }

  return (
    <View style={{ gap: Spacing.sm }}>
      {isBetaTester ? (
        <AppText variant="footnote" color="accent">
          Beta access active — full Pro features unlocked
        </AppText>
      ) : null}
      <TextInput
        style={styles.inviteInput}
        placeholder="Beta invite code"
        placeholderTextColor={colors.textTertiary}
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
      />
      <PrimaryButton label="Redeem invite" onPress={redeem} variant="secondary" />
      {status ? (
        <AppText variant="footnote" color="accent">
          {status}
        </AppText>
      ) : null}
      <AppText variant="caption" color="textTertiary">
        Internal testers receive a separate invite flag for early features.
      </AppText>
    </View>
  );
}

function createSettingsStyles(theme: AppTheme) {
  return StyleSheet.create({
  header: {
    gap: Spacing.xs,
    marginBottom: Spacing.xxl,
  },
  headerAccent: {
    width: 40,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.colors.primary,
    marginTop: Spacing.sm,
  },
  accessBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  accessBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.accent,
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
  aboutBlock: {
    marginTop: Spacing.xl,
    gap: Spacing.xs,
    paddingBottom: Spacing.xxxl,
  },
  aboutTagline: {
    letterSpacing: 2,
    marginTop: Spacing.xs,
  },
  inviteInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: Spacing.md,
    color: theme.colors.textPrimary,
  },
  validationPanel: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  validationRow: {
    gap: 2,
  },
  validationValue: {
    fontFamily: 'Menlo',
  },
  });
}
