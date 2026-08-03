import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import {
  BASELINE_LIFTS,
  collectBaselines,
  estimateOneRepMaxLbs,
  type BaselineLiftId,
} from '@/constants/strengthBaseline';
import { useAuth } from '@/hooks/useAuth';
import { userService } from '@/services/userService';

type DraftRow = { weight: string; reps: string };
type Draft = Partial<Record<BaselineLiftId, DraftRow>>;

/**
 * Reported strength, used to pick starting weights.
 *
 * Without this the first working weight for any lift is a fixed fraction of bodyweight, which is
 * the same number for a decade-long lifter and a beginner who weighs the same.
 */
export default function StrengthBaselineScreen() {
  const { user, refreshProfile } = useAuth();
  const [draft, setDraft] = useState<Draft>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const stored = user?.strengthBaselines;
    if (!stored) return;
    const next: Draft = {};
    for (const lift of BASELINE_LIFTS) {
      const entry = stored[lift.id];
      if (entry) next[lift.id] = { weight: String(entry.weightLbs), reps: String(entry.reps) };
    }
    setDraft(next);
  }, [user?.strengthBaselines]);

  const baselines = useMemo(() => collectBaselines(draft), [draft]);
  const filledCount = Object.keys(baselines).length;

  const update = useCallback((lift: BaselineLiftId, field: keyof DraftRow, value: string) => {
    const digits = value.replace(/[^0-9]/g, '');
    setDraft((prev) => ({
      ...prev,
      [lift]: { weight: '', reps: '', ...prev[lift], [field]: digits },
    }));
  }, []);

  const save = useCallback(async () => {
    if (!user) return;

    setSaving(true);
    const result = await userService.updateProfile(user.id, { strengthBaselines: baselines });
    setSaving(false);

    if (!result.success) {
      Alert.alert('Could not save', result.error);
      return;
    }

    await refreshProfile();
    Alert.alert(
      'Saved',
      filledCount > 0
        ? 'New workouts will start from these numbers instead of an estimate. Lifts you have already logged keep using your logged weights.'
        : 'Cleared. Starting weights will be estimated from your bodyweight again.',
    );
    router.back();
  }, [user, baselines, filledCount, refreshProfile]);

  return (
    <ScreenContainer>
      <SectionHeader
        title="Your current strength"
        subtitle="Enter a set you know you can complete. Any one lift helps; all four is best. This only sets your starting weights — once you log a lift, your own numbers take over."
      />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {BASELINE_LIFTS.map((lift) => {
          const row = draft[lift.id];
          const weight = Number(row?.weight);
          const reps = Number(row?.reps);
          const estimate = estimateOneRepMaxLbs(weight, reps);

          return (
            <View key={lift.id} style={styles.card}>
              <AppText variant="bodyBold">{lift.label}</AppText>
              <AppText variant="caption" color="textTertiary">
                {lift.hint}
              </AppText>

              <View style={styles.inputRow}>
                <View style={styles.inputGroup}>
                  <AppText variant="caption" color="textSecondary">
                    Weight (lb)
                  </AppText>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    value={row?.weight ?? ''}
                    onChangeText={(value) => update(lift.id, 'weight', value)}
                    placeholder="185"
                    placeholderTextColor={LiftFlowColors.textTertiary}
                    maxLength={4}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <AppText variant="caption" color="textSecondary">
                    Reps
                  </AppText>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    value={row?.reps ?? ''}
                    onChangeText={(value) => update(lift.id, 'reps', value)}
                    placeholder="5"
                    placeholderTextColor={LiftFlowColors.textTertiary}
                    maxLength={2}
                  />
                </View>
              </View>

              {estimate > 0 ? (
                <AppText variant="caption" color="accent">
                  Estimated one-rep max ≈ {estimate} lb
                </AppText>
              ) : null}
            </View>
          );
        })}

        <AppText variant="caption" color="textTertiary">
          Estimates use the Epley formula. Nothing here asks you to test a true max.
        </AppText>

        <View style={styles.actions}>
          <PrimaryButton
            label={saving ? 'Saving…' : 'Save'}
            onPress={save}
            loading={saving}
            disabled={saving}
          />
          <PrimaryButton label="Cancel" variant="ghost" disabled={saving} onPress={() => router.back()} />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  card: {
    gap: Spacing.xs,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.border,
    backgroundColor: LiftFlowColors.surface,
  },
  inputRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  inputGroup: {
    flex: 1,
    gap: Spacing.xs,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: LiftFlowColors.textPrimary,
    backgroundColor: LiftFlowColors.background,
    fontSize: 16,
  },
  actions: {
    gap: Spacing.md,
  },
});
