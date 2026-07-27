import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { LiftFlowLogo } from '@/components/brand/LiftFlowLogo';
import {
  PremiumGoalPicker,
  premiumRankedToTrainingGoals,
} from '@/components/goals/PremiumGoalPicker';
import { TextField } from '@/components/layout/TextField';
import { OnboardingReveal } from '@/components/onboarding/OnboardingReveal';
import { OnboardingShell } from '@/components/onboarding/OnboardingShell';
import { ChipGrid, SelectableChip } from '@/components/onboarding/SelectableChip';
import { UnitPreferencesPicker } from '@/components/settings/UnitPreferencesPicker';
import { AppText } from '@/components/ui/AppText';
import { HeroImages } from '@/constants/imagery';
import {
  DAYS_PER_WEEK_OPTIONS,
  DIETARY_RESTRICTION_OPTIONS,
  FOOD_PREFERENCE_OPTIONS,
  GYM_PROFILES,
  MEALS_PER_DAY_OPTIONS,
  SEX_OPTIONS,
  WEEKDAY_OPTIONS,
  type GymProfileId,
} from '@/constants/onboardingCoach';
import type { PremiumGoalId } from '@/constants/premiumGoals';
import { Brand, Spacing } from '@/constants/theme';
import {
  EQUIPMENT_PRESETS,
  type EquipmentId,
  type TrainingLocationId,
} from '@/constants/trainingProfile';
import { DEFAULT_UNIT_PREFERENCES, type UnitPreferences } from '@/constants/units';
import { useAuth } from '@/hooks/useAuth';
import { useInsightRotator } from '@/hooks/useInsightRotator';
import { useUnits } from '@/hooks/useUnits';
import { buildGoalsProfilePayload } from '@/lib/trainingGoalsProfile';
import { preferredUnitsFromGranular } from '@/lib/unitConversion';
import { coachActivationService } from '@/services/coachActivationService';
import { productAnalyticsService } from '@/services/productAnalyticsService';
import { userService } from '@/services/userService';
import { workoutLocationService } from '@/services/workoutLocationService';
import type { CoachActivationResult } from '@/types/coachActivation';

/** Promise → personalize → reveal. Defer equipment detail, limitations, supplements to Settings. */
const TOTAL_STEPS = 7;

const EXPERIENCE_LEVELS = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
] as const;

type UserProfileSex = 'male' | 'female' | 'other' | 'prefer_not_to_say';

const STEP_META: Record<
  number,
  {
    title: string;
    subtitle?: string;
    hero?: string;
    fullBleed?: string;
    insightCategory?: 'training' | 'nutrition' | 'recovery' | 'coaching' | 'motivation' | 'performance';
  }
> = {
  1: {
    title: 'Who are you training for?',
    subtitle: 'A few details so your coach can size training and protein correctly.',
    fullBleed: HeroImages.onboarding.metrics,
    insightCategory: 'nutrition',
  },
  2: {
    title: 'What are we chasing?',
    subtitle: 'Pick what matters most — primary goal drives nutrition.',
    fullBleed: HeroImages.onboarding.goals,
    insightCategory: 'coaching',
  },
  3: {
    title: 'When do you lift?',
    subtitle: 'Your week sets the program. Cardio stays optional later.',
    insightCategory: 'training',
  },
  4: {
    title: 'Where do you train?',
    subtitle: 'We match exercises to your gym — equipment is pre-filled.',
    fullBleed: HeroImages.onboarding.location,
    insightCategory: 'training',
  },
  5: {
    title: 'How do you eat?',
    subtitle: 'Preferences shape meals and the grocery list.',
    insightCategory: 'nutrition',
  },
  6: {
    title: 'Building your system',
    subtitle: 'Training week, protein target, and groceries — one pass.',
    insightCategory: 'coaching',
  },
  7: {
    title: 'Your first win',
    subtitle: Brand.taglinePrimary,
    insightCategory: 'motivation',
  },
};

function ageToDateOfBirth(age: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  return d.toISOString().slice(0, 10);
}

export default function ProfileOnboardingScreen() {
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [activationStatus, setActivationStatus] = useState('Initializing…');
  const [activationResult, setActivationResult] = useState<CoachActivationResult | null>(null);
  const activationStarted = useRef(false);

  const [unitPrefs, setUnitPrefs] = useState<UnitPreferences>(DEFAULT_UNIT_PREFERENCES);
  const [ageInput, setAgeInput] = useState('');
  const [sex, setSex] = useState<UserProfileSex | null>(null);
  const [heightCmInput, setHeightCmInput] = useState('');
  const [heightInInput, setHeightInInput] = useState('');
  const [heightFtInput, setHeightFtInput] = useState('');
  const [heightInchesInput, setHeightInchesInput] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [premiumGoals, setPremiumGoals] = useState<PremiumGoalId[]>([]);
  const [daysPerWeek, setDaysPerWeek] = useState<number | null>(4);
  const [preferredDays, setPreferredDays] = useState<string[]>([]);
  const [trainingLocation, setTrainingLocation] = useState<TrainingLocationId | null>(null);
  const [equipment, setEquipment] = useState<EquipmentId[]>([]);
  const [mealsPerDay, setMealsPerDay] = useState<number | null>(4);
  const [foodPreferences, setFoodPreferences] = useState<string[]>([]);
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([]);
  const [experience, setExperience] = useState('intermediate');

  const meta = STEP_META[step] ?? STEP_META[1];
  const { insight, nextInsight } = useInsightRotator(meta.insightCategory);
  const units = useUnits(unitPrefs);

  const selectLocation = useCallback((id: GymProfileId) => {
    setTrainingLocation(id);
    const gym = GYM_PROFILES.find((g) => g.id === id);
    const preset = gym?.preset ?? 'home_gym';
    setEquipment([...(EQUIPMENT_PRESETS[preset]?.equipment ?? EQUIPMENT_PRESETS.home_gym.equipment)]);
  }, []);

  const toggleChip = useCallback((value: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }, []);

  const saveProfile = useCallback(async () => {
    if (!user || !trainingLocation || premiumGoals.length === 0 || equipment.length === 0 || !daysPerWeek) {
      Alert.alert('Almost there', 'Complete goals, schedule, and where you train.');
      return false;
    }

    const rankedGoals = premiumRankedToTrainingGoals(premiumGoals);
    const age = parseInt(ageInput, 10);

    let heightCm: number | undefined;
    if (unitPrefs.preferredHeightUnit === 'cm') heightCm = units.parseHeightCm(heightCmInput);
    else if (unitPrefs.preferredHeightUnit === 'in') heightCm = units.parseHeightIn(heightInInput);
    else heightCm = units.parseHeightFtIn(heightFtInput, heightInchesInput);

    const weightKg = units.parseWeight(weightInput);

    const result = await userService.updateProfile(user.id, {
      trainingLocation,
      availableEquipment: equipment,
      ...buildGoalsProfilePayload(rankedGoals),
      ...unitPrefs,
      preferredUnits: preferredUnitsFromGranular(unitPrefs),
      sex: sex ?? undefined,
      dateOfBirth: age > 0 && age < 120 ? ageToDateOfBirth(age) : undefined,
      heightCm,
      weightKg,
      trainingExperience: (experience as 'beginner' | 'intermediate' | 'advanced') || 'intermediate',
      onboardingCompleted: true,
      metadata: {
        coachProfile: {
          age: age > 0 ? age : undefined,
          timeline: 'moderate',
          daysPerWeek,
          minutesPerWorkout: 60,
          preferredWorkoutDays: preferredDays,
          preferredWorkoutTimes: [],
          mealsPerDay: mealsPerDay ?? 4,
          foodPreferences,
          dietaryRestrictions,
          currentSupplements: [],
        },
      },
    });

    if (!result.success) {
      Alert.alert('Could not save profile', result.error);
      return false;
    }

    await workoutLocationService.ensureFromProfile(user.id, {
      trainingLocation,
      availableEquipment: equipment,
    });

    await refreshProfile();
    return true;
  }, [
    user,
    trainingLocation,
    premiumGoals,
    equipment,
    daysPerWeek,
    unitPrefs,
    ageInput,
    sex,
    heightCmInput,
    heightInInput,
    heightFtInput,
    heightInchesInput,
    weightInput,
    experience,
    units,
    preferredDays,
    mealsPerDay,
    foodPreferences,
    dietaryRestrictions,
    refreshProfile,
  ]);

  const runActivation = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    setActivationStatus('Saving your profile…');

    const saved = await saveProfile();
    if (!saved) {
      setSaving(false);
      setStep(5);
      activationStarted.current = false;
      return;
    }

    setActivationStatus('Building your training week…');
    const activateResult = await coachActivationService.activate(user.id);

    if (!activateResult.success) {
      setSaving(false);
      Alert.alert(
        'Coach activation incomplete',
        activateResult.error + '\n\nYour profile was saved. You can generate a program from Settings.',
      );
      setActivationResult(null);
      setStep(7);
      return;
    }

    setActivationStatus('Locking protein targets & groceries…');
    setActivationResult(activateResult.data);
    await refreshProfile();
    void productAnalyticsService.trackOnboardingCompleted(user.id);
    setSaving(false);
    setStep(7);
  }, [user, saveProfile, refreshProfile]);

  useEffect(() => {
    if (step !== 6 || saving || activationStarted.current) return;
    activationStarted.current = true;
    void runActivation();
  }, [step, saving, runActivation]);

  function canContinue(): boolean {
    if (step === 1) return !!sex && !!weightInput.trim();
    if (step === 2) return premiumGoals.length > 0;
    if (step === 3) return daysPerWeek != null && preferredDays.length > 0;
    if (step === 4) return trainingLocation != null;
    if (step === 5) return mealsPerDay != null;
    return true;
  }

  function handleContinue() {
    nextInsight();
    if (step === 5) {
      setStep(6);
      return;
    }
    if (step === 7) {
      router.replace('/(tabs)/dashboard');
      return;
    }
    if (step < TOTAL_STEPS) setStep((s) => s + 1);
  }

  function handleBack() {
    if (step > 1 && step < 6) setStep((s) => s - 1);
  }

  function renderStepContent() {
    switch (step) {
      case 1:
        return (
          <View style={styles.stack}>
            <UnitPreferencesPicker value={unitPrefs} onChange={setUnitPrefs} disabled={saving} />
            <ChipGrid>
              {SEX_OPTIONS.map((opt) => (
                <SelectableChip
                  key={opt.id}
                  label={opt.label}
                  selected={sex === opt.id}
                  onPress={() => setSex(opt.id as UserProfileSex)}
                />
              ))}
            </ChipGrid>
            <TextField
              label={`Weight (${units.weightLabel})`}
              placeholder={unitPrefs.preferredWeightUnit === 'kg' ? '80' : '175'}
              keyboardType="numeric"
              value={weightInput}
              onChangeText={setWeightInput}
            />
            <TextField
              label="Age (optional)"
              placeholder="28"
              keyboardType="numeric"
              value={ageInput}
              onChangeText={setAgeInput}
            />
            {unitPrefs.preferredHeightUnit === 'cm' ? (
              <TextField
                label="Height cm (optional)"
                placeholder="175"
                keyboardType="numeric"
                value={heightCmInput}
                onChangeText={setHeightCmInput}
              />
            ) : null}
            {unitPrefs.preferredHeightUnit === 'in' ? (
              <TextField
                label="Height in (optional)"
                placeholder="69"
                keyboardType="numeric"
                value={heightInInput}
                onChangeText={setHeightInInput}
              />
            ) : null}
            {unitPrefs.preferredHeightUnit === 'ft_in' ? (
              <View style={styles.heightRow}>
                <TextField
                  label="Feet"
                  placeholder="5"
                  keyboardType="numeric"
                  value={heightFtInput}
                  onChangeText={setHeightFtInput}
                  style={styles.heightField}
                />
                <TextField
                  label="Inches"
                  placeholder="10"
                  keyboardType="numeric"
                  value={heightInchesInput}
                  onChangeText={setHeightInchesInput}
                  style={styles.heightField}
                />
              </View>
            ) : null}
            <AppText variant="footnote" color="textSecondary">
              Experience
            </AppText>
            <ChipGrid>
              {EXPERIENCE_LEVELS.map((opt) => (
                <SelectableChip
                  key={opt.id}
                  label={opt.label}
                  selected={experience === opt.id}
                  onPress={() => setExperience(opt.id)}
                />
              ))}
            </ChipGrid>
          </View>
        );
      case 2:
        return <PremiumGoalPicker rankedPremiumGoals={premiumGoals} onChange={setPremiumGoals} disabled={saving} />;
      case 3:
        return (
          <View style={styles.stack}>
            <AppText variant="footnote" color="textSecondary">
              Lift days per week
            </AppText>
            <ChipGrid>
              {DAYS_PER_WEEK_OPTIONS.map((n) => (
                <SelectableChip
                  key={n}
                  label={`${n}×`}
                  selected={daysPerWeek === n}
                  onPress={() => setDaysPerWeek(n)}
                />
              ))}
            </ChipGrid>
            <AppText variant="footnote" color="textSecondary">
              Preferred days
            </AppText>
            <ChipGrid>
              {WEEKDAY_OPTIONS.map((d) => (
                <SelectableChip
                  key={d.id}
                  label={d.label}
                  selected={preferredDays.includes(d.id)}
                  onPress={() => toggleChip(d.id, preferredDays, setPreferredDays)}
                />
              ))}
            </ChipGrid>
          </View>
        );
      case 4:
        return (
          <ChipGrid>
            {GYM_PROFILES.map((opt) => (
              <SelectableChip
                key={opt.id}
                label={opt.label}
                selected={trainingLocation === opt.id}
                onPress={() => selectLocation(opt.id)}
              />
            ))}
          </ChipGrid>
        );
      case 5:
        return (
          <View style={styles.stack}>
            <AppText variant="footnote" color="textSecondary">
              Meals per day
            </AppText>
            <ChipGrid>
              {MEALS_PER_DAY_OPTIONS.map((n) => (
                <SelectableChip
                  key={n}
                  label={`${n}`}
                  selected={mealsPerDay === n}
                  onPress={() => setMealsPerDay(n)}
                />
              ))}
            </ChipGrid>
            <AppText variant="footnote" color="textSecondary">
              Food you like
            </AppText>
            <ChipGrid>
              {FOOD_PREFERENCE_OPTIONS.map((food) => (
                <SelectableChip
                  key={food}
                  label={food}
                  selected={foodPreferences.includes(food)}
                  onPress={() => toggleChip(food, foodPreferences, setFoodPreferences)}
                />
              ))}
            </ChipGrid>
            <AppText variant="footnote" color="textSecondary">
              Restrictions
            </AppText>
            <ChipGrid>
              {DIETARY_RESTRICTION_OPTIONS.map((d) => (
                <SelectableChip
                  key={d}
                  label={d}
                  selected={dietaryRestrictions.includes(d)}
                  onPress={() => toggleChip(d, dietaryRestrictions, setDietaryRestrictions)}
                />
              ))}
            </ChipGrid>
          </View>
        );
      case 6:
        return (
          <View style={styles.building}>
            <LiftFlowLogo size={96} variant="primary" />
            <AppText variant="body" color="textSecondary" align="center">
              {activationStatus}
            </AppText>
          </View>
        );
      case 7:
        return <OnboardingReveal result={activationResult} />;
      default:
        return null;
    }
  }

  const isBuilding = step === 6;
  const isReveal = step === 7;

  return (
    <OnboardingShell
      step={step}
      totalSteps={TOTAL_STEPS}
      title={isReveal ? '' : meta.title}
      subtitle={isReveal ? undefined : meta.subtitle}
      fullBleedHero={meta.fullBleed}
      insight={step <= 5 ? insight : null}
      onContinue={handleContinue}
      continueLabel={isReveal ? 'Open Home' : isBuilding ? 'Building…' : 'Continue'}
      continueDisabled={!canContinue() || saving || isBuilding}
      loading={saving || isBuilding}
      hideProgress={isBuilding || isReveal}
      onBack={step > 1 && step < 6 ? handleBack : undefined}>
      {renderStepContent()}
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.md },
  heightRow: { flexDirection: 'row', gap: Spacing.md },
  heightField: { flex: 1 },
  building: {
    alignItems: 'center',
    gap: Spacing.xl,
    paddingVertical: Spacing.xxxl,
  },
});
