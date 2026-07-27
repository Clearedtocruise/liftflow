import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { LogoMark } from '@/components/brand/LogoMark';
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
import { Brand, LiftFlowColors, Radius, Spacing } from '@/constants/theme';
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

/** Streamlined funnel: 10 inputs → review → build → ready */
const TOTAL_STEPS = 13;
const REVIEW_STEP = 11;
const BUILD_STEP = 12;
const READY_STEP = 13;

const EXPERIENCE_LEVELS = [
  { id: 'beginner', label: 'Beginner', description: 'Under a year of consistent training' },
  { id: 'intermediate', label: 'Intermediate', description: 'A year or more with structure' },
  { id: 'advanced', label: 'Advanced', description: 'Several years, structured programs' },
] as const;

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
  1: {
    title: 'Your units',
    subtitle: 'Stored in metric. Shown your way.',
    hero: HeroImages.onboarding.units,
  },
  2: {
    title: 'About you',
    subtitle: 'These details power coaching and nutrition targets.',
    hero: HeroImages.onboarding.metrics,
    insightCategory: 'nutrition',
  },
  3: {
    title: 'Your goals',
    subtitle: 'Primary goal drives nutrition. All goals shape training.',
    hero: HeroImages.onboarding.goals,
    insightCategory: 'coaching',
  },
  4: {
    title: 'Your pace',
    subtitle: 'How hard should we push for results?',
    insightCategory: 'coaching',
  },
  5: {
    title: 'Your lifting week',
    subtitle: 'Lifting days set the program. Cardio stays optional.',
    insightCategory: 'training',
  },
  6: {
    title: 'Where you train',
    subtitle: 'Gym type picks the right exercise library.',
    hero: HeroImages.onboarding.location,
    insightCategory: 'training',
  },
  7: {
    title: 'Your equipment',
    subtitle: 'We pre-filled from your gym — adjust if needed.',
    hero: HeroImages.onboarding.equipment,
    insightCategory: 'training',
  },
  8: {
    title: 'Limitations',
    subtitle: 'Injuries and restrictions keep the plan safe.',
    insightCategory: 'recovery',
  },
  9: {
    title: 'How you eat',
    subtitle: 'Preferences shape meals and your grocery list.',
    insightCategory: 'nutrition',
  },
  10: {
    title: 'Training experience',
    subtitle: 'We calibrate volume and intensity to your level.',
    insightCategory: 'training',
  },
  11: {
    title: 'Looks right?',
    subtitle: "ONE MORE will build training, nutrition, and today's workout from this.",
    insightCategory: 'motivation',
  },
  12: {
    title: 'Building your plan',
    subtitle: 'Training program, nutrition targets, and grocery list…',
    insightCategory: 'coaching',
  },
  13: {
    title: 'You are ready',
    subtitle: Brand.taglinePrimary,
    insightCategory: 'motivation',
  },
};

function ageToDateOfBirth(age: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  return d.toISOString().slice(0, 10);
}

function SectionLabel({ children }: { children: string }) {
  return (
    <AppText variant="caption" color="textTertiary" style={styles.sectionLabel}>
      {children}
    </AppText>
  );
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
      setStep(REVIEW_STEP);
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
      setStep(READY_STEP);
      return;
    }

    setActivationStatus('Finalizing nutrition & grocery list…');
    await refreshProfile();
    void productAnalyticsService.trackOnboardingCompleted(user.id);
    setSaving(false);
    setStep(READY_STEP);
  }, [user, saveProfile, refreshProfile]);

  useEffect(() => {
    if (step !== BUILD_STEP || saving || activationStarted.current) return;
    activationStarted.current = true;
    void runActivation();
  }, [step, saving, runActivation]);

  function canContinue(): boolean {
    if (step === 2) return !!sex && !!weightInput.trim();
    if (step === 3) return premiumGoals.length > 0;
    if (step === 4) return timeline != null;
    if (step === 5) return daysPerWeek != null && preferredDays.length > 0;
    if (step === 6) return trainingLocation != null;
    if (step === 7) return equipment.length > 0;
    if (step === 9) return mealsPerDay != null;
    return true;
  }

  function handleContinue() {
    nextInsight();
    if (step === REVIEW_STEP) {
      setStep(BUILD_STEP);
      return;
    }
    if (step === READY_STEP) {
      router.replace('/(tabs)/dashboard');
      return;
    }
    if (step < TOTAL_STEPS) setStep((s) => s + 1);
  }

  function handleBack() {
    if (step > 1 && step < BUILD_STEP) setStep((s) => s - 1);
  }

  const gymLabel = GYM_PROFILES.find((opt) => opt.id === trainingLocation)?.label ?? 'Not set';
  const timelineLabel = TIMELINE_OPTIONS.find((opt) => opt.id === timeline)?.label ?? 'Not set';
  const experienceLabel = EXPERIENCE_LEVELS.find((opt) => opt.id === experience)?.label ?? 'Intermediate';

  function renderStepContent() {
    switch (step) {
      case 1:
        return <UnitPreferencesPicker value={unitPrefs} onChange={setUnitPrefs} disabled={saving} />;
      case 2:
        return (
          <View style={styles.stack}>
            <SectionLabel>SEX</SectionLabel>
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
            <TextField label="Age" placeholder="28" keyboardType="numeric" value={ageInput} onChangeText={setAgeInput} />
            {unitPrefs.preferredHeightUnit === 'cm' ? (
              <TextField
                label="Height (cm)"
                placeholder="175"
                keyboardType="numeric"
                value={heightCmInput}
                onChangeText={setHeightCmInput}
              />
            ) : null}
            {unitPrefs.preferredHeightUnit === 'in' ? (
              <TextField
                label="Height (in)"
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
            <TextField
              label={`Weight (${units.weightLabel})`}
              placeholder={unitPrefs.preferredWeightUnit === 'kg' ? '80' : '175'}
              keyboardType="numeric"
              value={weightInput}
              onChangeText={setWeightInput}
            />
            <TextField
              label={`Goal weight (${units.weightLabel})`}
              placeholder="Optional"
              keyboardType="numeric"
              value={goalWeightInput}
              onChangeText={setGoalWeightInput}
            />
          </View>
        );
      case 3:
        return <PremiumGoalPicker rankedPremiumGoals={premiumGoals} onChange={setPremiumGoals} disabled={saving} />;
      case 4:
        return (
          <View style={styles.stack}>
            {TIMELINE_OPTIONS.map((opt) => (
              <SelectableChip
                key={opt.id}
                label={opt.label}
                description={opt.description}
                fullWidth
                selected={timeline === opt.id}
                onPress={() => setTimeline(opt.id)}
              />
            ))}
          </View>
        );
      case 5:
        return (
          <View style={styles.stack}>
            <SectionLabel>LIFT DAYS PER WEEK</SectionLabel>
            <ChipGrid>
              {DAYS_PER_WEEK_OPTIONS.map((n) => (
                <SelectableChip
                  key={n}
                  label={n === 7 ? 'Every day' : `${n}`}
                  selected={daysPerWeek === n}
                  onPress={() => setDaysPerWeek(n)}
                />
              ))}
            </ChipGrid>
            <SectionLabel>MINUTES PER SESSION</SectionLabel>
            <ChipGrid>
              {WORKOUT_DURATION_OPTIONS.map((n) => (
                <SelectableChip
                  key={n}
                  label={`${n}`}
                  selected={minutesPerWorkout === n}
                  onPress={() => setMinutesPerWorkout(n)}
                />
              ))}
            </ChipGrid>
            <SectionLabel>PREFERRED DAYS</SectionLabel>
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
            <SectionLabel>PREFERRED TIMES</SectionLabel>
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
          <View style={styles.stack}>
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
            {trainingLocation ? (
              <Animated.View entering={FadeInDown.duration(280)}>
                <TextField
                  label="Gym name (optional)"
                  placeholder={trainingLocation === 'home_gym' ? 'Home gym' : "e.g. Gold's Gym"}
                  value={primaryGymName}
                  onChangeText={setPrimaryGymName}
                />
              </Animated.View>
            ) : null}
          </View>
        );
      case 7:
        return <EquipmentPicker selected={equipment} onChange={(n) => setEquipment(n as EquipmentId[])} disabled={saving} />;
      case 8:
        return (
          <View style={styles.stack}>
            <SectionLabel>ANY AREAS TO PROTECT?</SectionLabel>
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
            <TextField
              label="Notes (optional)"
              placeholder="e.g. rotator cuff strain"
              value={limitationNotes}
              onChangeText={setLimitationNotes}
            />
            <TextField
              label="Exercises to avoid (comma-separated)"
              placeholder="e.g. overhead press, deep squats"
              value={exercisesToAvoid}
              onChangeText={setExercisesToAvoid}
            />
          </View>
        );
      case 9:
        return (
          <View style={styles.stack}>
            <SectionLabel>MEALS PER DAY</SectionLabel>
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
            <SectionLabel>FOOD PREFERENCES</SectionLabel>
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
            <SectionLabel>DIETARY RESTRICTIONS</SectionLabel>
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
            <SectionLabel>SUPPLEMENTS YOU USE</SectionLabel>
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
      case 10:
        return (
          <View style={styles.stack}>
            {EXPERIENCE_LEVELS.map((opt) => (
              <SelectableChip
                key={opt.id}
                label={opt.label}
                description={opt.description}
                fullWidth
                selected={experience === opt.id}
                onPress={() => setExperience(opt.id)}
              />
            ))}
          </View>
        );
      case REVIEW_STEP:
        return (
          <View style={styles.review}>
            <ReviewRow label="Goals" value={`${premiumGoals.length} selected`} />
            <ReviewRow label="Pace" value={timelineLabel} />
            <ReviewRow label="Lifting" value={`${daysPerWeek} days · ${minutesPerWorkout} min`} />
            <ReviewRow label="Gym" value={primaryGymName.trim() || gymLabel} />
            <ReviewRow label="Equipment" value={`${equipment.length} items`} />
            <ReviewRow label="Experience" value={experienceLabel} />
            <ReviewRow label="Meals" value={`${mealsPerDay ?? 4} / day`} />
          </View>
        );
      case BUILD_STEP:
        return (
          <View style={styles.building}>
            <LogoMark size={96} glow animate />
            <Animated.View entering={FadeIn.delay(200)}>
              <AppText variant="body" color="textSecondary" align="center">
                {activationStatus}
              </AppText>
            </Animated.View>
          </View>
        );
      case READY_STEP:
        return (
          <View style={styles.building}>
            <LogoMark size={88} glow animate />
            <AppText variant="headline" align="center">
              Your coach is ready.
            </AppText>
            <AppText variant="body" color="textSecondary" align="center">
              Training, nutrition, and today&apos;s workout are waiting on your dashboard.
            </AppText>
          </View>
        );
      default:
        return null;
    }
  }

  if (step === BUILD_STEP) {
    return (
      <OnboardingShell
        step={BUILD_STEP}
        totalSteps={TOTAL_STEPS}
        title={meta.title}
        subtitle={meta.subtitle}
        insight={null}
        hideProgress
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
      insight={step <= REVIEW_STEP ? insight : null}
      onContinue={handleContinue}
      continueLabel={
        step === READY_STEP ? 'Go to Dashboard' : step === REVIEW_STEP ? 'Build my plan' : 'Continue'
      }
      continueDisabled={!canContinue() || saving}
      loading={saving}
      hideProgress={step === READY_STEP}
      onBack={step > 1 && step < BUILD_STEP ? handleBack : undefined}>
      {renderStepContent()}
    </OnboardingShell>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <AppText variant="footnote" color="textTertiary">
        {label}
      </AppText>
      <AppText variant="bodyBold">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.md },
  sectionLabel: {
    letterSpacing: 1.1,
    marginTop: Spacing.xs,
  },
  heightRow: { flexDirection: 'row', gap: Spacing.md },
  heightField: { flex: 1 },
  review: {
    gap: Spacing.md,
    backgroundColor: LiftFlowColors.surface,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  reviewRow: {
    gap: 2,
  },
  building: {
    alignItems: 'center',
    gap: Spacing.xl,
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.md,
  },
});
