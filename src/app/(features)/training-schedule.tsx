import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { ChipGrid, SelectableChip } from '@/components/onboarding/SelectableChip';
import { AppText } from '@/components/ui/AppText';
import { DAYS_PER_WEEK_OPTIONS, WEEKDAY_OPTIONS } from '@/constants/onboardingCoach';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { resolveDaysPerWeek, summarizeTrainingSchedule, trainingScheduleLabel } from '@/lib/trainingSchedule';
import { trainingService } from '@/services/trainingService';
import { userService } from '@/services/userService';

function toggleDay(dayId: string, selected: string[], setSelected: (days: string[]) => void) {
  if (selected.includes(dayId)) {
    setSelected(selected.filter((id) => id !== dayId));
    return;
  }
  setSelected([...selected, dayId]);
}

export default function TrainingScheduleScreen() {
  const { user, refreshProfile } = useAuth();
  const [daysPerWeek, setDaysPerWeek] = useState<number>(6);
  const [preferredDays, setPreferredDays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const coach = user.metadata?.coachProfile;
    setDaysPerWeek(resolveDaysPerWeek(user));
    setPreferredDays(coach?.preferredWorkoutDays ?? []);
    setLoading(false);
  }, [user]);

  const save = useCallback(async () => {
    if (!user) return;
    if (preferredDays.length > 0 && preferredDays.length < daysPerWeek) {
      Alert.alert(
        'Pick more days',
        `You chose ${daysPerWeek} lifting days per week — select at least ${daysPerWeek} preferred days, or clear your day picks.`,
      );
      return;
    }

    setSaving(true);
    const result = await userService.updateProfile(user.id, {
      metadata: {
        ...(user.metadata ?? {}),
        coachProfile: {
          ...(user.metadata?.coachProfile ?? {}),
          daysPerWeek,
          preferredWorkoutDays: preferredDays,
        },
        coachActivation: {
          ...(user.metadata?.coachActivation ?? {}),
          frequency: daysPerWeek,
        },
      },
    });

    if (!result.success) {
      setSaving(false);
      Alert.alert('Could not save', result.error);
      return;
    }

    await refreshProfile();
    const regenResult = await trainingService.forceRegenerateProgram(user.id);
    setSaving(false);

    if (!regenResult.success) {
      Alert.alert(
        'Saved schedule',
        `Your preference was saved (${summarizeTrainingSchedule(daysPerWeek)}), but rebuild failed: ${regenResult.error}. Open the Workout tab — it will retry automatically.`,
      );
      router.back();
      return;
    }

    Alert.alert(
      'Plan updated',
      regenResult.data.regenerated
        ? `Your week is now built for ${summarizeTrainingSchedule(daysPerWeek)}.`
        : 'Your lifting frequency is saved. Open Workout if the week still looks wrong.',
    );
    router.back();
  }, [user, daysPerWeek, preferredDays, refreshProfile]);

  return (
    <ScreenContainer>
      <SectionHeader
        title="Workouts per week"
        subtitle="How many days you lift sets your weekly split. Changing this rebuilds your program."
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {loading ? (
          <AppText variant="body" color="textSecondary">
            Loading…
          </AppText>
        ) : (
          <>
            <AppText variant="footnote" color="textSecondary">
              Lifting days per week
            </AppText>
            <ChipGrid>
              {DAYS_PER_WEEK_OPTIONS.map((n) => (
                <SelectableChip
                  key={n}
                  label={trainingScheduleLabel(n)}
                  selected={daysPerWeek === n}
                  onPress={() => setDaysPerWeek(n)}
                  disabled={saving}
                />
              ))}
            </ChipGrid>

            <AppText variant="caption" color="textSecondary">
              {summarizeTrainingSchedule(daysPerWeek)}
            </AppText>

            <AppText variant="footnote" color="textSecondary">
              Preferred days (optional)
            </AppText>
            <ChipGrid>
              {WEEKDAY_OPTIONS.map((day) => (
                <SelectableChip
                  key={day.id}
                  label={day.label}
                  selected={preferredDays.includes(day.id)}
                  onPress={() => toggleDay(day.id, preferredDays, setPreferredDays)}
                  disabled={saving}
                />
              ))}
            </ChipGrid>
            <AppText variant="caption" color="textTertiary">
              Used for reminders and scheduling hints. Your split still fills the number of lifting days above.
            </AppText>
          </>
        )}

        <View style={styles.actions}>
          <PrimaryButton label={saving ? 'Saving…' : 'Save & rebuild plan'} loading={saving} disabled={saving} onPress={save} />
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
