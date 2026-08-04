import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { ChipGrid, SelectableChip } from '@/components/onboarding/SelectableChip';
import { AppText } from '@/components/ui/AppText';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { PROGRAM_SPLIT_OPTIONS, programSplitLabel, resolveProgramType } from '@/lib/programSplit';
import { resolveDaysPerWeek } from '@/lib/trainingSchedule';
import { trainingService } from '@/services/trainingService';
import { userService } from '@/services/userService';
import type { ProgramFrequency, ProgramType } from '@/types';

/**
 * Change the weekly split without deleting the program clock.
 *
 * Regeneration used to re-infer split from goals and silently overwrite Push/Pull/Legs with
 * Strength — so regen now preserves programType. This screen is the explicit way to switch.
 */
export default function TrainingSplitScreen() {
  const { user, refreshProfile } = useAuth();
  const [programType, setProgramType] = useState<ProgramType>('push_pull_legs');
  const [initialType, setInitialType] = useState<ProgramType>('push_pull_legs');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    void (async () => {
      const dash = await trainingService.getDashboard(user.id);
      const meta = dash.success ? (dash.data?.program.metadata ?? null) : null;
      const resolved = resolveProgramType(user, meta);
      if (cancelled) return;
      setProgramType(resolved);
      setInitialType(resolved);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const save = useCallback(async () => {
    if (!user) return;

    if (programType === initialType) {
      router.back();
      return;
    }

    setSaving(true);

    const frequency = resolveDaysPerWeek(user) as ProgramFrequency;
    const goal = user.primaryTrainingGoal ?? user.fitnessGoals?.[0] ?? 'muscle_gain';

    const profileResult = await userService.updateProfile(user.id, {
      metadata: {
        ...(user.metadata ?? {}),
        coachActivation: {
          ...(user.metadata?.coachActivation ?? {}),
          programType,
          frequency,
        },
      },
    });

    if (!profileResult.success) {
      setSaving(false);
      Alert.alert('Could not save', profileResult.error);
      return;
    }

    const genResult = await trainingService.generateProgram(user.id, {
      programType,
      frequency,
      goal,
      experience: user.trainingExperience ?? 'intermediate',
      equipment: user.availableEquipment,
    });

    await refreshProfile();
    setSaving(false);

    if (!genResult.success) {
      Alert.alert(
        'Split saved',
        'Your preference was saved, but the week could not rebuild right now. Open the Workout tab to retry.',
      );
      router.back();
      return;
    }

    Alert.alert(
      'Plan updated',
      `Your week is now ${programSplitLabel(programType)}. Week number and start date are unchanged.`,
    );
    router.back();
  }, [user, programType, initialType, refreshProfile]);

  const selectedHint = PROGRAM_SPLIT_OPTIONS.find((o) => o.id === programType)?.hint;

  return (
    <ScreenContainer>
      <SectionHeader
        title="Training split"
        subtitle="How your lift days are organized. Changing this rebuilds the current week — your program week clock stays put."
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {loading ? (
          <AppText variant="body" color="textSecondary">
            Loading…
          </AppText>
        ) : (
          <>
            <AppText variant="footnote" color="textSecondary">
              Current: {programSplitLabel(initialType)}
            </AppText>
            <ChipGrid>
              {PROGRAM_SPLIT_OPTIONS.map((opt) => (
                <SelectableChip
                  key={opt.id}
                  label={opt.label}
                  selected={programType === opt.id}
                  onPress={() => {
                    if (!saving) setProgramType(opt.id);
                  }}
                />
              ))}
            </ChipGrid>
            {selectedHint ? (
              <AppText variant="caption" color="textTertiary">
                {selectedHint}
              </AppText>
            ) : null}
          </>
        )}

        <View style={styles.actions}>
          <PrimaryButton
            label={saving ? 'Rebuilding…' : 'Save & rebuild week'}
            loading={saving}
            disabled={saving || loading}
            onPress={() => {
              void save();
            }}
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
  actions: {
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
});
