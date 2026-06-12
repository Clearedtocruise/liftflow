import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { AdaptationNotice } from '@/components/adaptation/AdaptationNotice';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { SelectableChip } from '@/components/onboarding/SelectableChip';
import { AppText } from '@/components/ui/AppText';
import {
  DIETARY_RESTRICTION_OPTIONS,
  FOOD_PREFERENCE_OPTIONS,
  MEALS_PER_DAY_OPTIONS,
  WORKOUT_TIME_OPTIONS,
} from '@/constants/onboardingCoach';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { adaptationService } from '@/services/adaptationService';
import { userService } from '@/services/userService';
import type { PreferenceAdaptationReport } from '@/types/adaptation';
import type { UserProfileMetadata } from '@/types/user';

function toggleChip(value: string, selected: string[], setSelected: (next: string[]) => void) {
  setSelected(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
}

export default function NutritionPreferencesScreen() {
  const { user, refreshProfile } = useAuth();
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([]);
  const [foodPreferences, setFoodPreferences] = useState<string[]>([]);
  const [mealsPerDay, setMealsPerDay] = useState<number>(4);
  const [workoutTime, setWorkoutTime] = useState<string>('morning');
  const [saving, setSaving] = useState(false);
  const [adaptation, setAdaptation] = useState<PreferenceAdaptationReport | null>(null);

  useEffect(() => {
    if (!user) return;
    const coach = user.metadata?.coachProfile;
    setDietaryRestrictions(coach?.dietaryRestrictions ?? []);
    setFoodPreferences(coach?.foodPreferences ?? []);
    setMealsPerDay(coach?.mealsPerDay ?? 4);
    setWorkoutTime(coach?.preferredWorkoutTimes?.[0] ?? 'morning');
  }, [user]);

  const save = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    setAdaptation(null);

    const metadata: UserProfileMetadata = {
      ...(user.metadata ?? {}),
      coachProfile: {
        ...(user.metadata?.coachProfile ?? {}),
        dietaryRestrictions,
        foodPreferences,
        mealsPerDay,
        preferredWorkoutTimes: [workoutTime],
      },
    };

    const profileResult = await userService.updateProfile(user.id, { metadata });
    if (!profileResult.success) {
      setSaving(false);
      Alert.alert('Could not save', profileResult.error);
      return;
    }

    await refreshProfile();
    const adaptResult = await adaptationService.applyChanges(user.id, 'nutrition');
    setSaving(false);

    if (adaptResult.success) {
      setAdaptation(adaptResult.data);
      Alert.alert(
        adaptResult.data.notificationTitle,
        adaptResult.data.adapted ? adaptResult.data.notificationBody : 'Nutrition preferences updated.',
      );
    } else {
      Alert.alert('Saved', 'Preferences saved. Meal plan will update on next refresh.');
    }
    router.back();
  }, [user, dietaryRestrictions, foodPreferences, mealsPerDay, workoutTime, refreshProfile]);

  return (
    <ScreenContainer>
      <SectionHeader
        title="Nutrition preferences"
        subtitle="Allergies, diet, meal schedule, and foods you enjoy — your plan adapts instantly."
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {adaptation ? <AdaptationNotice report={adaptation} /> : null}

        <AppText variant="bodyBold">Dietary restrictions & allergies</AppText>
        <View style={styles.chips}>
          {DIETARY_RESTRICTION_OPTIONS.map((option) => (
            <SelectableChip
              key={option}
              label={option}
              selected={dietaryRestrictions.includes(option)}
              onPress={() => toggleChip(option, dietaryRestrictions, setDietaryRestrictions)}
            />
          ))}
        </View>

        <AppText variant="bodyBold">Foods you enjoy</AppText>
        <View style={styles.chips}>
          {FOOD_PREFERENCE_OPTIONS.map((option) => (
            <SelectableChip
              key={option}
              label={option}
              selected={foodPreferences.includes(option)}
              onPress={() => toggleChip(option, foodPreferences, setFoodPreferences)}
            />
          ))}
        </View>

        <AppText variant="bodyBold">Meals per day</AppText>
        <View style={styles.chips}>
          {MEALS_PER_DAY_OPTIONS.map((count) => (
            <SelectableChip
              key={count}
              label={`${count}`}
              selected={mealsPerDay === count}
              onPress={() => setMealsPerDay(count)}
            />
          ))}
        </View>

        <AppText variant="bodyBold">Typical workout time</AppText>
        <View style={styles.chips}>
          {WORKOUT_TIME_OPTIONS.map((option) => (
            <SelectableChip
              key={option.id}
              label={option.label}
              selected={workoutTime === option.id}
              onPress={() => setWorkoutTime(option.id)}
            />
          ))}
        </View>

        <View style={styles.actions}>
          <PrimaryButton label={saving ? 'Saving…' : 'Save & adapt meals'} loading={saving} onPress={save} />
          <PrimaryButton label="Cancel" variant="ghost" disabled={saving} onPress={() => router.back()} />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: Spacing.lg, paddingBottom: Spacing.xxxl },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  actions: { gap: Spacing.md, marginTop: Spacing.md },
});
