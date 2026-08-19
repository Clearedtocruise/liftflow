import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

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
import { Brand, LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { summarizeGoals } from '@/constants/trainingGoals';
import { getPrimaryGymLabel, summarizeEquipment } from '@/constants/trainingProfile';
import { summarizeUnitPreferences } from '@/constants/units';
import { usePlanAdjustment } from '@/contexts/PlanAdjustmentContext';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useUnits } from '@/hooks/useUnits';
import { loadRolloverValidationState, type RolloverValidationState } from '@/lib/rolloverDebug';
import {
    isTabataModeEnabled,
    TABATA_MODE_PREF_KEY,
    tabataModeSummary,
} from '@/lib/trainingPreferences';
import { invalidateWeekPlanPrefetch, warmWeekPlanData } from '@/lib/planDataPrefetch';
import { planDataCache } from '@/lib/planDataCache';
import {
  isSelfDirectedNutrition,
  isSelfDirectedTraining,
  selfDirectedNutritionSummary,
  selfDirectedTrainingSummary,
} from '@/lib/selfDirectedMode';
import { resolveDaysPerWeek, summarizeTrainingSchedule } from '@/lib/trainingSchedule';
import { resolveUnitPreferences } from '@/lib/unitConversion';
import { coachingPrefsPatch } from '@/lib/voice/voicePreferences';
import { dataResetService, formatResetConfirmation, type DataResetType } from '@/services/dataResetService';
import { deviceLocationService } from '@/services/deviceLocationService';
import { exportService } from '@/services/exportService';
import { feedbackService } from '@/services/feedbackService';
import { nutritionService } from '@/services/nutritionService';
import { trainingService } from '@/services/trainingService';
import { userService } from '@/services/userService';
import { useWorkoutSession } from '@/state/workout/WorkoutSessionContext';
import type { ConfirmationMode } from '@/types/common';
import type { VoiceInputMode } from '@/types/voice';

export default function SettingsScreen() {
  const { user, signOut, refreshProfile, deleteAccount } = useAuth();
  const { bumpRevision, dismiss } = usePlanAdjustment();
  const { hydrate: hydrateWorkoutSession } = useWorkoutSession();
  const units = useUnits();
  const { isPremium, isFounder, isBetaTester } = useSubscription();
  const [confirmationMode, setConfirmationMode] = useState<ConfirmationMode>('smart');
  const [voiceAutoLog, setVoiceAutoLog] = useState(true);
  const [voiceFeedback, setVoiceFeedback] = useState(true);
  const [voiceInputMode, setVoiceInputMode] = useState<VoiceInputMode>('push_to_talk');
  const [exporting, setExporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [locationDetection, setLocationDetection] = useState(true);
  const [locationPermission, setLocationPermission] = useState<string>('—');
  const [tabataMode, setTabataMode] = useState(false);
  const [validationState, setValidationState] = useState<RolloverValidationState | null>(null);
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [uploadKind, setUploadKind] = useState<'workout' | 'nutrition' | null>(null);
  const [uploadDraft, setUploadDraft] = useState('');
  const [uploadingPlan, setUploadingPlan] = useState(false);

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
        setTabataMode(isTabataModeEnabled(result.data));
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

  const beginEditDisplayName = useCallback(() => {
    setDisplayNameDraft(user?.displayName?.trim() ?? '');
    setEditingDisplayName(true);
  }, [user?.displayName]);

  const saveDisplayName = useCallback(async () => {
    if (!user) return;
    const next = displayNameDraft.trim().replace(/\s+/g, ' ');
    if (!next) {
      Alert.alert('Name required', 'Enter the name home should greet you with.');
      return;
    }
    setSavingDisplayName(true);
    const result = await userService.updateProfile(user.id, { displayName: next });
    setSavingDisplayName(false);
    if (!result.success) {
      Alert.alert('Could not save name', result.error);
      return;
    }
    setEditingDisplayName(false);
    await refreshProfile();
  }, [user, displayNameDraft, refreshProfile]);

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

  async function handleUploadPersonalPlan() {
    if (!user || !uploadKind) return;
    const text = uploadDraft.trim();
    if (text.length < 40) {
      Alert.alert('Paste more of the plan', 'Copy the workout or meal text from your PDF, then paste it here.');
      return;
    }
    setUploadingPlan(true);
    const result = await trainingService.uploadPersonalPlan({
      kind: uploadKind,
      filename: `${uploadKind}-plan.pdf`,
      text,
    });
    setUploadingPlan(false);
    if (!result.success) {
      Alert.alert('Could not load that plan', result.error);
      return;
    }
    invalidateWeekPlanPrefetch(user.id, user.timezone);
    await planDataCache.clearUser(user.id);
    await warmWeekPlanData(user.id, user.timezone);
    bumpRevision();
    await refreshProfile();
    setUploadKind(null);
    setUploadDraft('');
    Alert.alert(
      'Plan uploaded',
      uploadKind === 'workout'
        ? `${result.data.plannedWorkouts} workouts for the week starting ${result.data.weekStart}.`
        : `${result.data.mealsInserted} meals for the week starting ${result.data.weekStart}.`,
    );
  }

  return (
    <ScreenContainer keyboardAvoiding>
      <View style={styles.header}>
        <AppText variant="headline">Settings</AppText>
        {user ? (
          <AppText variant="footnote" color="textSecondary">
            {user.displayName ?? user.email}
          </AppText>
        ) : null}
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
        <View style={styles.headerAccent} />
      </View>

      <SectionHeader title="Voice & Logging" />
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
            voiceInputMode === 'continuous'
                ? 'Continuous'
                : 'Tap once · auto-stop'
          }
          onPress={() => {
            Alert.alert(
              'Voice input mode',
              'Tap once to start. Recording stops when you finish speaking and your music resumes.',
              [
                { text: 'Tap once · auto-stop (recommended)', onPress: () => saveVoiceInputMode('tap_toggle') },
                { text: 'Continuous', onPress: () => saveVoiceInputMode('continuous') },
                { text: 'Cancel', style: 'cancel' },
              ],
            );
          }}
        />
        <SettingsRow label="Wake phrase" value="Coming soon" />
      </Card>

      <View style={styles.sectionGap}>
        <SectionHeader
          title="Workout style"
          subtitle="Tabata only when enabled — work and rest timers adjustable 10–45s in workout"
        />
      </View>
      <Card style={styles.group}>
        <SettingsRow
          label="Tabata mode"
          value={tabataMode ? `On · ${tabataModeSummary()}` : 'Off'}
          icon={
            <AppSymbol name="timer" fallback="⏱" size={20} tintColor={LiftFlowColors.textSecondary} />
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
                'Enable location for ONE MORE in your device Settings to auto-detect your gym.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Open Settings', onPress: () => deviceLocationService.openAppSettings() },
                ],
              );
            }
          }}
        />
      </Card>

      <View style={styles.sectionGap}>
        <SectionHeader
          title="Do it yourself"
          subtitle="Turn off coach autopilot when you want to run your own sessions and meals"
        />
      </View>
      <Card style={styles.group}>
        <SettingsRow
          label="Load Aggressive Cut plan"
          value="193→180 · 6-day + meals"
          icon={
            <AppSymbol name="target" fallback="🎯" size={20} tintColor={LiftFlowColors.textSecondary} />
          }
          onPress={() => {
            if (!user) return;
            Alert.alert(
              'Load your cut plan?',
              'Replaces this week’s workouts and untouched meal-plan slots with your PDF plan: 6-day home-gym split + cut nutrition (≈2175 kcal · 210g protein). Logged meals stay.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Load plan',
                  onPress: () => {
                    void (async () => {
                      const result = await trainingService.loadPersonalPlan('aggressive_cut');
                      if (!result.success) {
                        Alert.alert('Could not load plan', result.error);
                        return;
                      }
                      invalidateWeekPlanPrefetch(user.id, user.timezone);
                      await planDataCache.clearUser(user.id);
                      await warmWeekPlanData(user.id, user.timezone);
                      bumpRevision();
                      await refreshProfile();
                      Alert.alert(
                        'Cut plan loaded',
                        `${result.data.plannedWorkouts} workouts · ${result.data.mealsInserted} meals for the week starting ${result.data.weekStart}.`,
                        [
                          { text: 'OK', style: 'cancel' },
                          {
                            text: 'Open Nutrition',
                            onPress: () => router.push('/(tabs)/nutrition'),
                          },
                          {
                            text: 'Open Workout',
                            onPress: () => router.push('/(tabs)/workout'),
                          },
                        ],
                      );
                    })();
                  },
                },
              ],
            );
          }}
        />
        <SettingsRow
          label="Upload workout PDF"
          value="Paste the plan text"
          icon={
            <AppSymbol name="doc.fill" fallback="📄" size={20} tintColor={LiftFlowColors.textSecondary} />
          }
          onPress={() => {
            setUploadKind('workout');
            setUploadDraft('');
          }}
        />
        <SettingsRow
          label="Upload nutrition PDF"
          value="Paste the meal plan text"
          icon={
            <AppSymbol name="leaf.fill" fallback="🥗" size={20} tintColor={LiftFlowColors.textSecondary} />
          }
          onPress={() => {
            setUploadKind('nutrition');
            setUploadDraft('');
          }}
        />
        {uploadKind ? (
          <View style={styles.uploadBox}>
            <AppText variant="label" color="accent">
              {uploadKind === 'workout' ? 'Workout plan' : 'Nutrition plan'}
            </AppText>
            <AppText variant="footnote" color="textSecondary">
              Open the PDF, select the week, copy it, and paste it here. We turn that text into this week’s plan and keep it for later weeks.
            </AppText>
            <TextInput
              value={uploadDraft}
              onChangeText={setUploadDraft}
              placeholder="Paste plan text from your PDF…"
              placeholderTextColor={LiftFlowColors.textTertiary}
              multiline
              textAlignVertical="top"
              style={styles.uploadInput}
            />
            <PrimaryButton
              label={uploadingPlan ? 'Reading plan…' : 'Load pasted plan'}
              onPress={() => void handleUploadPersonalPlan()}
              loading={uploadingPlan}
              disabled={uploadingPlan}
            />
            <PrimaryButton
              label="Cancel"
              variant="ghost"
              onPress={() => {
                setUploadKind(null);
                setUploadDraft('');
              }}
            />
          </View>
        ) : null}
        <SettingsRow
          label="My own workouts"
          value={selfDirectedTrainingSummary(isSelfDirectedTraining(user))}
          icon={
            <AppSymbol name="dumbbell.fill" fallback="🏋" size={20} tintColor={LiftFlowColors.textSecondary} />
          }
          onPress={() => {
            if (!user) return;
            const next = !isSelfDirectedTraining(user);
            Alert.alert(
              next ? 'Log your own workouts?' : 'Let ONE MORE plan workouts?',
              next
                ? 'Home and Workout will center on Quick log. The app will stop auto-building your training week. Your history stays.'
                : 'ONE MORE will rebuild your training week from your split and schedule again.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: next ? 'Use my own workouts' : 'Use coach plan',
                  onPress: () => {
                    void (async () => {
                      const result = await userService.updateProfile(user.id, {
                        metadata: {
                          ...(user.metadata ?? {}),
                          coachProfile: {
                            ...(user.metadata?.coachProfile ?? {}),
                            selfDirectedTraining: next,
                          },
                        },
                      });
                      if (!result.success) {
                        Alert.alert('Could not save', result.error);
                        return;
                      }
                      invalidateWeekPlanPrefetch(user.id, user.timezone);
                      await planDataCache.clearUser(user.id);
                      bumpRevision();
                      await refreshProfile();
                      if (next) {
                        Alert.alert(
                          'Your own workouts',
                          'Coach week planning is off. Use Log my workout on Home or the Workout tab.',
                          [
                            { text: 'OK', style: 'cancel' },
                            {
                              text: 'Log my workout',
                              onPress: () => router.push('/(tabs)/workout/manual-log'),
                            },
                          ],
                        );
                      }
                    })();
                  },
                },
              ],
            );
          }}
        />
        <SettingsRow
          label="My own nutrition"
          value={selfDirectedNutritionSummary(isSelfDirectedNutrition(user))}
          icon={
            <AppSymbol name="leaf.fill" fallback="🥗" size={20} tintColor={LiftFlowColors.textSecondary} />
          }
          onPress={() => {
            if (!user) return;
            const next = !isSelfDirectedNutrition(user);
            Alert.alert(
              next ? 'Log your own meals?' : 'Let ONE MORE plan meals?',
              next
                ? 'Nutrition will stop filling empty days with a meal plan. Untouched coach meals for this week are cleared. Meals you already logged stay.'
                : 'ONE MORE can generate and fill meal-plan days again.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: next ? 'Use my own nutrition' : 'Use meal plans',
                  onPress: () => {
                    void (async () => {
                      const result = await userService.updateProfile(user.id, {
                        metadata: {
                          ...(user.metadata ?? {}),
                          coachProfile: {
                            ...(user.metadata?.coachProfile ?? {}),
                            selfDirectedNutrition: next,
                          },
                        },
                      });
                      if (!result.success) {
                        Alert.alert('Could not save', result.error);
                        return;
                      }
                      if (next) {
                        await nutritionService.clearPlannedMealsForWeek(user.id, user.timezone);
                      } else {
                        await nutritionService.ensureWeekMealCoverage(user.id, user.timezone);
                      }
                      invalidateWeekPlanPrefetch(user.id, user.timezone);
                      await planDataCache.clearUser(user.id);
                      bumpRevision();
                      await refreshProfile();
                      if (next) {
                        Alert.alert(
                          'Your own nutrition',
                          'Coach meal planning is off. Use Log a Meal on the Nutrition tab.',
                          [
                            { text: 'OK', style: 'cancel' },
                            {
                              text: 'Open Nutrition',
                              onPress: () => router.push('/(tabs)/nutrition'),
                            },
                          ],
                        );
                      }
                    })();
                  },
                },
              ],
            );
          }}
        />
      </Card>

      <View style={styles.sectionGap}>
        <SectionHeader title="Training & Preferences" subtitle="How ONE MORE plans your training" />
      </View>
      <Card style={styles.group}>
        <SettingsRow
          label="Workouts per week"
          value={user ? summarizeTrainingSchedule(resolveDaysPerWeek(user)) : 'Not set'}
          icon={
            <AppSymbol name="calendar" fallback="📅" size={20} tintColor={LiftFlowColors.textSecondary} />
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
            <AppSymbol name="target" fallback="🎯" size={20} tintColor={LiftFlowColors.textSecondary} />
          }
          onPress={() => router.push('/(features)/training-goals')}
        />
        <SettingsRow
          label="Current strength"
          value={
            user?.strengthBaselines && Object.keys(user.strengthBaselines).length > 0
              ? `${Object.keys(user.strengthBaselines).length} lifts recorded`
              : 'Set starting weights'
          }
          icon={
            <AppSymbol name="scalemass" fallback="🏋️" size={20} tintColor={LiftFlowColors.textSecondary} />
          }
          onPress={() => router.push('/(features)/strength-baseline')}
        />
        <SettingsRow
          label="Units"
          value={user ? summarizeUnitPreferences(resolveUnitPreferences(user)) : 'Not set'}
          icon={
            <AppSymbol name="ruler.fill" fallback="📏" size={20} tintColor={LiftFlowColors.textSecondary} />
          }
          onPress={() => router.push('/(features)/unit-preferences')}
        />
        <SettingsRow
          label="Gym equipment"
          value={user?.availableEquipment?.length ? summarizeEquipment(user.availableEquipment) : 'Set up equipment'}
          icon={
            <AppSymbol name="dumbbell.fill" fallback="🏋" size={20} tintColor={LiftFlowColors.textSecondary} />
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
            <AppSymbol name="leaf.fill" fallback="🥗" size={20} tintColor={LiftFlowColors.textSecondary} />
          }
          onPress={() => router.push('/(features)/nutrition-preferences')}
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
        {editingDisplayName ? (
          <View style={styles.displayNameEditor}>
            <AppText variant="caption" color="textSecondary">
              Display name
            </AppText>
            <TextInput
              style={styles.displayNameInput}
              value={displayNameDraft}
              onChangeText={setDisplayNameDraft}
              placeholder="Your name"
              placeholderTextColor={LiftFlowColors.textTertiary}
              autoFocus
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={() => {
                void saveDisplayName();
              }}
            />
            <View style={styles.displayNameActions}>
              <PrimaryButton
                label="Cancel"
                variant="secondary"
                onPress={() => setEditingDisplayName(false)}
              />
              <PrimaryButton
                label={savingDisplayName ? 'Saving…' : 'Save'}
                onPress={() => {
                  void saveDisplayName();
                }}
              />
            </View>
          </View>
        ) : (
          <SettingsRow
            label="Display name"
            value={user?.displayName?.trim() || 'Add your name'}
            icon={
              <AppSymbol
                name="person.text.rectangle"
                fallback={SYMBOL_FALLBACKS['person.fill']}
                size={20}
                tintColor={LiftFlowColors.textSecondary}
              />
            }
            onPress={beginEditDisplayName}
          />
        )}
        <SettingsRow
          label="Weight"
          value={user?.weightKg ? units.formatWeight(user.weightKg) : 'Not set'}
          icon={
            <AppSymbol name="figure.stand" fallback={SYMBOL_FALLBACKS['figure.stand']} size={20} tintColor={LiftFlowColors.textSecondary} />
          }
          onPress={() => router.push('/(tabs)/progress')}
        />
        <SettingsRow
          label="AI Coaching Hub"
          value={`${user?.trainingExperience ?? 'Beginner'} · Recovery, training, nutrition`}
          icon={
            <AppSymbol name="person.fill" fallback={SYMBOL_FALLBACKS['person.fill']} size={20} tintColor={LiftFlowColors.textSecondary} />
          }
          onPress={() => router.push('/(tabs)/coaching')}
        />
        <SettingsRow
          label="Daily recovery check-in"
          icon={
            <AppSymbol name="heart.fill" fallback="♥" size={20} tintColor={LiftFlowColors.textSecondary} />
          }
          onPress={() => router.push('/(features)/recovery-check-in')}
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
        <SectionHeader title="ONE MORE Pro" />
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
            <AppSymbol name="creditcard.fill" fallback={SYMBOL_FALLBACKS['creditcard.fill']} size={20} tintColor={LiftFlowColors.textSecondary} />
          }
          onPress={() => router.push(isPremium ? '/(features)/manage-subscription' : '/(features)/upgrade')}
        />
        <SettingsRow
          label="Compare plans"
          value="Free vs Pro"
          icon={
            <AppSymbol name="sparkles" fallback={SYMBOL_FALLBACKS.sparkles} size={20} tintColor={LiftFlowColors.textSecondary} />
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
        <SectionHeader title="Explore" subtitle="Everything ONE MORE can do" />
      </View>
      <Card style={styles.group}>
        {/* Only entry point into the Explore hub: its tab is hidden via `href: null`, so without
            this row the screen was unreachable in the shipped app. */}
        <SettingsRow
          label="Explore features"
          value="Live and coming soon"
          icon={
            <AppSymbol name="sparkles" fallback="✦" size={20} tintColor={LiftFlowColors.textSecondary} />
          }
          onPress={() => router.push('/(tabs)/explore')}
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
        <SectionHeader title="Beta" subtitle="Closed beta program" />
      </View>
      <Card style={styles.group}>
        <BetaInviteRow userId={user?.id} isBetaTester={isBetaTester} onRedeemed={refreshProfile} />
      </Card>

      <View style={styles.sectionGap}>
        <SectionHeader title="Validation" subtitle="Current app state for testing" />
      </View>
      <Card style={styles.group}>
        <ValidationDebugPanel state={validationState} onRefresh={refreshValidationState} />
      </Card>

      <View style={styles.sectionGap}>
        <SectionHeader title="Account" />
      </View>
      <Card style={styles.group}>
        <SettingsRow
          label="Reset Workout Data"
          value={resetting ? 'Resetting…' : undefined}
          icon={
            <AppSymbol name="arrow.counterclockwise" fallback="↺" size={20} tintColor={LiftFlowColors.textSecondary} />
          }
          onPress={resetting ? undefined : handleResetWorkoutData}
        />
        <SettingsRow
          label="Reset Nutrition Data"
          value={resetting ? 'Resetting…' : undefined}
          icon={
            <AppSymbol name="arrow.counterclockwise" fallback="↺" size={20} tintColor={LiftFlowColors.textSecondary} />
          }
          onPress={resetting ? undefined : handleResetNutritionData}
        />
        <SettingsRow
          label="Reset Workout + Nutrition"
          value={resetting ? 'Resetting…' : undefined}
          icon={
            <AppSymbol name="arrow.counterclockwise" fallback="↺" size={20} tintColor={LiftFlowColors.textSecondary} />
          }
          onPress={resetting ? undefined : handleResetWorkoutAndNutritionData}
        />
        <SettingsRow
          label="Full Test Reset"
          value={resetting ? 'Resetting…' : 'Includes equipment'}
          icon={
            <AppSymbol name="arrow.counterclockwise" fallback="↺" size={20} tintColor={LiftFlowColors.textSecondary} />
          }
          onPress={resetting ? undefined : handleFullTestReset}
        />
      </Card>
      <PrimaryButton label="Log Out" onPress={handleSignOut} variant="secondary" />
      <PrimaryButton label="Delete Account" onPress={handleDeleteAccount} variant="secondary" />

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
        placeholderTextColor={LiftFlowColors.textTertiary}
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

const styles = StyleSheet.create({
  header: {
    gap: Spacing.xs,
    marginBottom: Spacing.xxl,
  },
  headerAccent: {
    width: 40,
    height: 3,
    borderRadius: 2,
    backgroundColor: LiftFlowColors.primary,
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
    borderRadius: Radius.full,
    backgroundColor: LiftFlowColors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.accent,
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
    borderColor: LiftFlowColors.border,
    borderRadius: 12,
    padding: Spacing.md,
    color: LiftFlowColors.textPrimary,
  },
  displayNameEditor: {
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  displayNameInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.border,
    borderRadius: 12,
    padding: Spacing.md,
    color: LiftFlowColors.textPrimary,
  },
  uploadBox: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LiftFlowColors.border,
  },
  uploadInput: {
    minHeight: 140,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.border,
    borderRadius: 12,
    padding: Spacing.md,
    color: LiftFlowColors.textPrimary,
  },
  displayNameActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
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
