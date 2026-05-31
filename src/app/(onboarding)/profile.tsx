import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { LiftFlowLogo } from '@/components/brand/LiftFlowLogo';
import { EquipmentPicker } from '@/components/equipment/EquipmentPicker';
import {
    PremiumGoalPicker,
    premiumRankedToTrainingGoals,
} from '@/components/goals/PremiumGoalPicker';
import { TextField } from '@/components/layout/TextField';
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
    LIMITATION_BODY_AREAS,
    MEALS_PER_DAY_OPTIONS,
    SEX_OPTIONS,
    SUPPLEMENT_OPTIONS,
    TIMELINE_OPTIONS,
    WEEKDAY_OPTIONS,
    WORKOUT_DURATION_OPTIONS,
    WORKOUT_TIME_OPTIONS,
    type GymProfileId,
    type TimelineId,
} from '@/constants/onboardingCoach';
import type { PremiumGoalId } from '@/constants/premiumGoals';
import { Brand, LiftFlowColors, Spacing } from '@/constants/theme';
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
import { limitationService } from '@/services/limitationService';
import { productAnalyticsService } from '@/services/productAnalyticsService';
import { userService } from '@/services/userService';
import { workoutLocationService } from '@/services/workoutLocationService';

const TOTAL_STEPS = 16;

type UserProfileSex = 'male' | 'female' | 'other' | 'prefer_not_to_say';

const STEP_META: Record<
  number,
  {
    title: string;
    subtitle?: string;
    helper?: string;
    hero?: string;
    insightCategory?: 'training' | 'nutrition' | 'recovery' | 'coaching' | 'motivation' | 'performance';
  }
> = {
  1: { title: 'Your units', subtitle: 'Stored precisely in metric. Displayed your way.', hero: HeroImages.onboarding.units },
  2: {
    title: 'About you',
    subtitle: 'Personal details power smarter coaching and nutrition targets.',
    hero: HeroImages.onboarding.metrics,
    insightCategory: 'nutrition',
  },
  3: {
    title: 'Your goals',
    subtitle: 'Primary goal drives nutrition. All goals shape your workouts.',
    hero: HeroImages.onboarding.goals,
    insightCategory: 'coaching',
  },
  4: {
    title: 'Your timeline',
    subtitle: 'How quickly do you want results?',
    insightCategory: 'coaching',
  },
  5: {
    title: 'Your schedule',
    subtitle: 'When and how often you train shapes your program.',
    insightCategory: 'training',
  },
  6: {
    title: 'Where do you train?',
    subtitle: 'Your gym profile determines exercise selection.',
    hero: HeroImages.onboarding.location,
    insightCategory: 'training',
  },
  7: { title: 'Name your gym', subtitle: 'Optional — helpful at multiple locations.', hero: HeroImages.onboarding.location },
  8: {
    title: 'Your equipment',
    subtitle: 'Confirm what you can use — we pre-filled from your gym type.',
    hero: HeroImages.onboarding.equipment,
    insightCategory: 'training',
  },
  9: {
    title: 'Limitations',
    subtitle: 'Injuries and restrictions keep your program safe.',
    insightCategory: 'recovery',
  },
  10: {
    title: 'Nutrition profile',
    subtitle: 'Food preferences shape your meal plan and grocery list.',
    insightCategory: 'nutrition',
  },
  11: {
    title: 'Training experience',
    subtitle: 'We calibrate volume and intensity to your level.',
    insightCategory: 'training',
  },
  12: {
    title: 'Recovery drives results',
    subtitle: 'LiftFlow adapts training based on sleep, energy, and soreness.',
    insightCategory: 'recovery',
  },
  13: {
    title: 'Nutrition that adapts',
    subtitle: 'Macros update with training load and recovery — no manual recalculation.',
    insightCategory: 'nutrition',
  },
  14: { title: 'Review your system', subtitle: 'Your AI coach is about to build your complete plan.', insightCategory: 'motivation' },
  15: { title: 'Building your plan', subtitle: 'Creating your training program, nutrition plan, and grocery list…', insightCategory: 'coaching' },
  16: { title: "You're ready", subtitle: Brand.taglinePrimary, insightCategory: 'motivation' },
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
  const activationStarted = useRef(false);

  const [unitPrefs, setUnitPrefs] = useState<UnitPreferences>(DEFAULT_UNIT_PREFERENCES);
  const [ageInput, setAgeInput] = useState('');
  const [sex, setSex] = useState<UserProfileSex | null>(null);
  const [heightCmInput, setHeightCmInput] = useState('');
  const [heightInInput, setHeightInInput] = useState('');
  const [heightFtInput, setHeightFtInput] = useState('');
  const [heightInchesInput, setHeightInchesInput] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [goalWeightInput, setGoalWeightInput] = useState('');
  const [premiumGoals, setPremiumGoals] = useState<PremiumGoalId[]>([]);
  const [timeline, setTimeline] = useState<TimelineId | null>(null);
  const [daysPerWeek, setDaysPerWeek] = useState<number | null>(4);
  const [minutesPerWorkout, setMinutesPerWorkout] = useState<number | null>(60);
  const [preferredDays, setPreferredDays] = useState<string[]>([]);
  const [preferredTimes, setPreferredTimes] = useState<string[]>([]);
  const [trainingLocation, setTrainingLocation] = useState<TrainingLocationId | null>(null);
  const [primaryGymName, setPrimaryGymName] = useState('');
  const [equipment, setEquipment] = useState<EquipmentId[]>([]);
  const [limitationAreas, setLimitationAreas] = useState<string[]>([]);
  const [limitationNotes, setLimitationNotes] = useState('');
  const [exercisesToAvoid, setExercisesToAvoid] = useState('');
  const [mealsPerDay, setMealsPerDay] = useState<number | null>(4);
  const [foodPreferences, setFoodPreferences] = useState<string[]>([]);
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([]);
  const [currentSupplements, setCurrentSupplements] = useState<string[]>([]);
  const [experience, setExperience] = useState('');

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
    if (!user || !trainingLocation || premiumGoals.length === 0 || equipment.length === 0 || !timeline || !daysPerWeek) {
      Alert.alert('Almost there', 'Complete gym type, equipment, goals, timeline, and schedule.');
      return false;
    }

    const rankedGoals = premiumRankedToTrainingGoals(premiumGoals);
    const age = parseInt(ageInput, 10);

    let heightCm: number | undefined;
    if (unitPrefs.preferredHeightUnit === 'cm') heightCm = units.parseHeightCm(heightCmInput);
    else if (unitPrefs.preferredHeightUnit === 'in') heightCm = units.parseHeightIn(heightInInput);
    else heightCm = units.parseHeightFtIn(heightFtInput, heightInchesInput);

    const weightKg = units.parseWeight(weightInput);
    const goalWeightKg = goalWeightInput.trim() ? units.parseWeight(goalWeightInput) : undefined;

    const result = await userService.updateProfile(user.id, {
      trainingLocation,
      primaryGymName: primaryGymName.trim() || undefined,
      availableEquipment: equipment,
      ...buildGoalsProfilePayload(rankedGoals),
      ...unitPrefs,
      preferredUnits: preferredUnitsFromGranular(unitPrefs),
      sex: sex ?? undefined,
      dateOfBirth: age > 0 && age < 120 ? ageToDateOfBirth(age) : undefined,
      heightCm,
      weightKg,
      trainingExperience: experience
        ? (experience.toLowerCase() as 'beginner' | 'intermediate' | 'advanced')
        : 'intermediate',
      onboardingCompleted: true,
      metadata: {
        coachProfile: {
          age: age > 0 ? age : undefined,
          goalWeightKg,
          timeline,
          daysPerWeek,
          minutesPerWorkout: minutesPerWorkout ?? 60,
          preferredWorkoutDays: preferredDays,
          preferredWorkoutTimes: preferredTimes,
          mealsPerDay: mealsPerDay ?? 4,
          foodPreferences,
          dietaryRestrictions,
          currentSupplements,
          limitationNotes: limitationNotes.trim() || undefined,
          exercisesToAvoid: exercisesToAvoid
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        },
      },
    });

    if (!result.success) {
      Alert.alert('Could not save profile', result.error);
      return false;
    }

    await workoutLocationService.ensureFromProfile(user.id, {
      primaryGymName: primaryGymName.trim() || undefined,
      trainingLocation,
      availableEquipment: equipment,
    });

    for (const area of limitationAreas) {
      await limitationService.create(user.id, {
        limitationType: 'injury',
        bodyArea: area,
        description: limitationNotes.trim() || undefined,
        affectedMovements: exercisesToAvoid
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      });
    }

    await refreshProfile();
    return true;
  }, [
    user,
    trainingLocation,
    premiumGoals,
    equipment,
    timeline,
    daysPerWeek,
    unitPrefs,
    ageInput,
    sex,
    heightCmInput,
    heightInInput,
    heightFtInput,
    heightInchesInput,
    weightInput,
    goalWeightInput,
    experience,
    units,
    primaryGymName,
    minutesPerWorkout,
    preferredDays,
    preferredTimes,
    mealsPerDay,
    foodPreferences,
    dietaryRestrictions,
    currentSupplements,
    limitationAreas,
    limitationNotes,
    exercisesToAvoid,
    refreshProfile,
  ]);

  const runActivation = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    setActivationStatus('Saving your profile…');

    const saved = await saveProfile();
    if (!saved) {
      setSaving(false);
      setStep(14);
      activationStarted.current = false;
      return;
    }

    setActivationStatus('Building your training program…');
    const activateResult = await coachActivationService.activate(user.id);

    if (!activateResult.success) {
      setSaving(false);
      Alert.alert(
        'Coach activation incomplete',
        activateResult.error + '\n\nYour profile was saved. You can generate a program from Settings.',
      );
      setStep(16);
      return;
    }

    setActivationStatus('Finalizing nutrition & grocery list…');
    await refreshProfile();
    void productAnalyticsService.trackOnboardingCompleted(user.id);
    setSaving(false);
    setStep(16);
  }, [user, saveProfile, refreshProfile]);

  useEffect(() => {
    if (step !== 15 || saving || activationStarted.current) return;
    activationStarted.current = true;
    void runActivation();
  }, [step, saving, runActivation]);

  function canContinue(): boolean {
    if (step === 2) return !!sex && !!weightInput.trim();
    if (step === 3) return premiumGoals.length > 0;
    if (step === 4) return timeline != null;
    if (step === 5) return daysPerWeek != null && preferredDays.length > 0;
    if (step === 6) return trainingLocation != null;
    if (step === 8) return equipment.length > 0;
    if (step === 10) return mealsPerDay != null;
    return true;
  }

  function handleContinue() {
    nextInsight();
    if (step === 14) {
      setStep(15);
      return;
    }
    if (step === 16) {
      router.replace('/(tabs)/dashboard');
      return;
    }
    if (step < TOTAL_STEPS) setStep((s) => s + 1);
  }

  function handleBack() {
    if (step > 1 && step < 15) setStep((s) => s - 1);
  }

  function renderStepContent() {
    switch (step) {
      case 1:
        return <UnitPreferencesPicker value={unitPrefs} onChange={setUnitPrefs} disabled={saving} />;
      case 2:
        return (
          <View style={styles.stack}>
            <ChipGrid>
              {SEX_OPTIONS.map((opt) => (
                <SelectableChip key={opt.id} label={opt.label} selected={sex === opt.id} onPress={() => setSex(opt.id as UserProfileSex)} />
              ))}
            </ChipGrid>
            <TextField label="Age" placeholder="28" keyboardType="numeric" value={ageInput} onChangeText={setAgeInput} />
            {unitPrefs.preferredHeightUnit === 'cm' ? (
              <TextField label="Height (cm)" placeholder="175" keyboardType="numeric" value={heightCmInput} onChangeText={setHeightCmInput} />
            ) : null}
            {unitPrefs.preferredHeightUnit === 'in' ? (
              <TextField label="Height (in)" placeholder="69" keyboardType="numeric" value={heightInInput} onChangeText={setHeightInInput} />
            ) : null}
            {unitPrefs.preferredHeightUnit === 'ft_in' ? (
              <View style={styles.heightRow}>
                <TextField label="Feet" placeholder="5" keyboardType="numeric" value={heightFtInput} onChangeText={setHeightFtInput} style={styles.heightField} />
                <TextField label="Inches" placeholder="10" keyboardType="numeric" value={heightInchesInput} onChangeText={setHeightInchesInput} style={styles.heightField} />
              </View>
            ) : null}
            <TextField label={`Weight (${units.weightLabel})`} placeholder={unitPrefs.preferredWeightUnit === 'kg' ? '80' : '175'} keyboardType="numeric" value={weightInput} onChangeText={setWeightInput} />
            <TextField label={`Goal weight (${units.weightLabel})`} placeholder="Optional" keyboardType="numeric" value={goalWeightInput} onChangeText={setGoalWeightInput} />
          </View>
        );
      case 3:
        return <PremiumGoalPicker rankedPremiumGoals={premiumGoals} onChange={setPremiumGoals} disabled={saving} />;
      case 4:
        return (
          <ChipGrid>
            {TIMELINE_OPTIONS.map((opt) => (
              <SelectableChip key={opt.id} label={opt.label} selected={timeline === opt.id} onPress={() => setTimeline(opt.id)} />
            ))}
          </ChipGrid>
        );
      case 5:
        return (
          <View style={styles.stack}>
            <AppText variant="footnote" color="textSecondary">Days per week</AppText>
            <ChipGrid>
              {DAYS_PER_WEEK_OPTIONS.map((n) => (
                <SelectableChip key={n} label={`${n}x`} selected={daysPerWeek === n} onPress={() => setDaysPerWeek(n)} />
              ))}
            </ChipGrid>
            <AppText variant="footnote" color="textSecondary">Minutes per workout</AppText>
            <ChipGrid>
              {WORKOUT_DURATION_OPTIONS.map((n) => (
                <SelectableChip key={n} label={`${n} min`} selected={minutesPerWorkout === n} onPress={() => setMinutesPerWorkout(n)} />
              ))}
            </ChipGrid>
            <AppText variant="footnote" color="textSecondary">Preferred days</AppText>
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
            <AppText variant="footnote" color="textSecondary">Preferred times</AppText>
            <ChipGrid>
              {WORKOUT_TIME_OPTIONS.map((t) => (
                <SelectableChip
                  key={t.id}
                  label={t.label}
                  selected={preferredTimes.includes(t.id)}
                  onPress={() => toggleChip(t.id, preferredTimes, setPreferredTimes)}
                />
              ))}
            </ChipGrid>
          </View>
        );
      case 6:
        return (
          <ChipGrid>
            {GYM_PROFILES.map((opt) => (
              <SelectableChip key={opt.id} label={opt.label} selected={trainingLocation === opt.id} onPress={() => selectLocation(opt.id)} />
            ))}
          </ChipGrid>
        );
      case 7:
        return (
          <TextField
            label="Gym name (optional)"
            placeholder={trainingLocation === 'home_gym' ? 'Home gym' : 'e.g. Gold\'s Gym'}
            value={primaryGymName}
            onChangeText={setPrimaryGymName}
          />
        );
      case 8:
        return <EquipmentPicker selected={equipment} onChange={(n) => setEquipment(n as EquipmentId[])} disabled={saving} />;
      case 9:
        return (
          <View style={styles.stack}>
            <AppText variant="footnote" color="textSecondary">Any injuries or mobility issues?</AppText>
            <ChipGrid>
              {LIMITATION_BODY_AREAS.map((area) => (
                <SelectableChip
                  key={area}
                  label={area}
                  selected={limitationAreas.includes(area)}
                  onPress={() => toggleChip(area, limitationAreas, setLimitationAreas)}
                />
              ))}
            </ChipGrid>
            <TextField label="Notes (optional)" placeholder="e.g. rotator cuff strain" value={limitationNotes} onChangeText={setLimitationNotes} />
            <TextField label="Exercises to avoid (comma-separated)" placeholder="e.g. overhead press, deep squats" value={exercisesToAvoid} onChangeText={setExercisesToAvoid} />
          </View>
        );
      case 10:
        return (
          <View style={styles.stack}>
            <AppText variant="footnote" color="textSecondary">Meals per day</AppText>
            <ChipGrid>
              {MEALS_PER_DAY_OPTIONS.map((n) => (
                <SelectableChip key={n} label={`${n}`} selected={mealsPerDay === n} onPress={() => setMealsPerDay(n)} />
              ))}
            </ChipGrid>
            <AppText variant="footnote" color="textSecondary">Food preferences</AppText>
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
            <AppText variant="footnote" color="textSecondary">Dietary restrictions</AppText>
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
            <AppText variant="footnote" color="textSecondary">Supplements you currently use</AppText>
            <ChipGrid>
              {SUPPLEMENT_OPTIONS.map((s) => (
                <SelectableChip
                  key={s}
                  label={s}
                  selected={currentSupplements.includes(s)}
                  onPress={() => toggleChip(s, currentSupplements, setCurrentSupplements)}
                />
              ))}
            </ChipGrid>
          </View>
        );
      case 11:
        return (
          <TextField
            label="Experience level"
            placeholder="beginner / intermediate / advanced"
            value={experience}
            onChangeText={setExperience}
          />
        );
      case 12:
      case 13:
        return (
          <AppText variant="body" color="textSecondary">
            {step === 12
              ? 'Daily check-ins help LiftFlow know when to push and when to pull back — your program adapts automatically.'
              : 'Your meal plan, macro targets, and grocery list are generated from your profile and updated as training changes.'}
          </AppText>
        );
      case 14:
        return (
          <View style={styles.review}>
            <AppText variant="body">Goals: {premiumGoals.length} selected</AppText>
            <AppText variant="body">Schedule: {daysPerWeek}x/week · {minutesPerWorkout} min</AppText>
            <AppText variant="body">Gym: {trainingLocation ?? '—'}</AppText>
            <AppText variant="body">Equipment: {equipment.length} items</AppText>
            <AppText variant="body">Timeline: {timeline ?? '—'}</AppText>
          </View>
        );
      case 15:
        return (
          <View style={styles.building}>
            <LiftFlowLogo size={96} variant="primary" />
            <AppText variant="body" color="textSecondary" align="center">
              {activationStatus}
            </AppText>
          </View>
        );
      case 16:
        return (
          <View style={styles.building}>
            <AppText variant="display" align="center">🎉</AppText>
            <AppText variant="headline" align="center">Your AI Fitness Coach is ready.</AppText>
            <AppText variant="footnote" color="textSecondary" align="center">
              Training program, nutrition plan, and today&apos;s workout are waiting on your dashboard.
            </AppText>
          </View>
        );
      default:
        return null;
    }
  }

  if (step === 15) {
    return (
      <OnboardingShell
        step={15}
        totalSteps={TOTAL_STEPS}
        title={meta.title}
        subtitle={meta.subtitle}
        insight={insight}
        onContinue={() => {}}
        continueLabel="Building…"
        continueDisabled
        loading>
        {renderStepContent()}
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      step={step}
      totalSteps={TOTAL_STEPS}
      title={meta.title}
      subtitle={meta.subtitle}
      helperText={meta.helper}
      heroImage={meta.hero}
      insight={step <= 14 ? insight : null}
      onContinue={handleContinue}
      continueLabel={step === 16 ? 'Go to Dashboard' : 'Continue'}
      continueDisabled={!canContinue() || saving}
      loading={saving}
      onBack={step > 1 && step < 15 ? handleBack : undefined}>
      {renderStepContent()}
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.md },
  heightRow: { flexDirection: 'row', gap: Spacing.md },
  heightField: { flex: 1 },
  review: {
    gap: Spacing.sm,
    backgroundColor: LiftFlowColors.surface,
    padding: Spacing.lg,
    borderRadius: 12,
  },
  building: { alignItems: 'center', gap: Spacing.xl, paddingVertical: Spacing.xxxl },
});
