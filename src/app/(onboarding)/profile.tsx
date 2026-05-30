import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { AuthFormContainer } from '@/components/auth/AuthFormContainer';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { TextField } from '@/components/layout/TextField';
import { ChipGrid, SelectableChip } from '@/components/onboarding/SelectableChip';
import { Spacing } from '@/constants/theme';
import {
    COMMERCIAL_GYM_EQUIPMENT,
    EQUIPMENT_OPTIONS,
    HOME_GYM_STARTER,
    TRAINING_GOALS,
    TRAINING_LOCATIONS,
    type EquipmentId,
    type TrainingGoalId,
    type TrainingLocationId,
} from '@/constants/trainingProfile';
import { useAuth } from '@/hooks/useAuth';
import { userService } from '@/services/userService';
import { workoutLocationService } from '@/services/workoutLocationService';

type Step = 'location' | 'equipment' | 'goal' | 'metrics';

export default function ProfileOnboardingScreen() {
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState<Step>('location');
  const [saving, setSaving] = useState(false);

  const [trainingLocation, setTrainingLocation] = useState<TrainingLocationId | null>(null);
  const [primaryGymName, setPrimaryGymName] = useState('');
  const [equipment, setEquipment] = useState<EquipmentId[]>([]);
  const [trainingGoal, setTrainingGoal] = useState<TrainingGoalId | null>(null);
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [experience, setExperience] = useState('');

  const toggleEquipment = useCallback((id: EquipmentId) => {
    setEquipment((prev) => {
      if (id === 'full_gym') {
        return prev.includes('full_gym') ? prev.filter((e) => e !== 'full_gym') : ['full_gym'];
      }
      const withoutFull = prev.filter((e) => e !== 'full_gym');
      return withoutFull.includes(id)
        ? withoutFull.filter((e) => e !== id)
        : [...withoutFull, id];
    });
  }, []);

  const selectLocation = useCallback((id: TrainingLocationId) => {
    setTrainingLocation(id);
    setEquipment(id === 'commercial_gym' ? [...COMMERCIAL_GYM_EQUIPMENT] : [...HOME_GYM_STARTER]);
  }, []);

  const finish = useCallback(async () => {
    if (!user || !trainingLocation || !trainingGoal || equipment.length === 0) {
      Alert.alert('Almost there', 'Select your gym type, equipment, and training goal.');
      return;
    }

    setSaving(true);
    const result = await userService.updateProfile(user.id, {
      trainingLocation,
      primaryGymName: primaryGymName.trim() || undefined,
      availableEquipment: equipment,
      primaryTrainingGoal: trainingGoal,
      fitnessGoals: [trainingGoal],
      heightCm: heightCm ? Number(heightCm) : undefined,
      weightKg: weightKg ? Number(weightKg) : undefined,
      trainingExperience: experience
        ? (experience.toLowerCase() as 'beginner' | 'intermediate' | 'advanced')
        : undefined,
      onboardingCompleted: true,
    });
    setSaving(false);

    if (!result.success) {
      Alert.alert('Could not save profile', result.error);
      return;
    }

    await workoutLocationService.ensureFromProfile(user.id, {
      primaryGymName: primaryGymName.trim() || undefined,
      trainingLocation,
      availableEquipment: equipment,
    });

    await refreshProfile();
    router.replace('/(tabs)/workout');
  }, [
    user,
    trainingLocation,
    trainingGoal,
    equipment,
    heightCm,
    weightKg,
    experience,
    refreshProfile,
  ]);

  const titles: Record<Step, { title: string; subtitle: string }> = {
    location: {
      title: 'Where do you train?',
      subtitle: 'Workouts adapt to your gym setup.',
    },
    equipment: {
      title: 'What equipment do you have?',
      subtitle: 'Select everything available. We only program exercises you can perform.',
    },
    goal: {
      title: 'What is your main goal?',
      subtitle: 'Sets, reps, and progression adjust to your focus.',
    },
    metrics: {
      title: 'Optional details',
      subtitle: 'Improve weight suggestions and coaching. Skip anytime.',
    },
  };

  const copy = titles[step];

  return (
    <AuthFormContainer title={copy.title} subtitle={copy.subtitle}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {step === 'location' ? (
          <View style={styles.locationStep}>
            <ChipGrid>
              {TRAINING_LOCATIONS.map((opt) => (
                <SelectableChip
                  key={opt.id}
                  label={opt.label}
                  selected={trainingLocation === opt.id}
                  onPress={() => selectLocation(opt.id)}
                />
              ))}
            </ChipGrid>
            {trainingLocation ? (
              <TextField
                label="Gym name (optional)"
                placeholder={trainingLocation === 'home_gym' ? 'Home gym' : 'e.g. LA Fitness'}
                value={primaryGymName}
                onChangeText={setPrimaryGymName}
              />
            ) : null}
          </View>
        ) : null}

        {step === 'equipment' ? (
          <ChipGrid>
            {EQUIPMENT_OPTIONS.map((opt) => (
              <SelectableChip
                key={opt.id}
                label={opt.label}
                selected={equipment.includes(opt.id)}
                onPress={() => toggleEquipment(opt.id)}
              />
            ))}
          </ChipGrid>
        ) : null}

        {step === 'goal' ? (
          <ChipGrid>
            {TRAINING_GOALS.map((opt) => (
              <SelectableChip
                key={opt.id}
                label={opt.label}
                selected={trainingGoal === opt.id}
                onPress={() => setTrainingGoal(opt.id)}
              />
            ))}
          </ChipGrid>
        ) : null}

        {step === 'metrics' ? (
          <View style={styles.metrics}>
            <TextField label="Height (cm)" placeholder="175" keyboardType="numeric" value={heightCm} onChangeText={setHeightCm} />
            <TextField label="Weight (kg)" placeholder="80" keyboardType="numeric" value={weightKg} onChangeText={setWeightKg} />
            <TextField label="Experience" placeholder="beginner / intermediate / advanced" value={experience} onChangeText={setExperience} />
          </View>
        ) : null}

        <View style={styles.actions}>
          {step !== 'location' ? (
            <PrimaryButton
              label="Back"
              variant="secondary"
              onPress={() => {
                if (step === 'equipment') setStep('location');
                else if (step === 'goal') setStep('equipment');
                else if (step === 'metrics') setStep('goal');
              }}
            />
          ) : null}

          {step === 'location' ? (
            <PrimaryButton
              label="Continue"
              size="large"
              disabled={!trainingLocation}
              onPress={() => setStep('equipment')}
            />
          ) : null}

          {step === 'equipment' ? (
            <PrimaryButton
              label="Continue"
              size="large"
              disabled={equipment.length === 0}
              onPress={() => setStep('goal')}
            />
          ) : null}

          {step === 'goal' ? (
            <PrimaryButton
              label="Continue"
              size="large"
              disabled={!trainingGoal}
              onPress={() => setStep('metrics')}
            />
          ) : null}

          {step === 'metrics' ? (
            <>
              <PrimaryButton label={saving ? 'Saving…' : 'Start Training'} size="large" loading={saving} onPress={finish} />
              <PrimaryButton label="Skip for now" variant="ghost" disabled={saving} onPress={finish} />
            </>
          ) : null}
        </View>
      </ScrollView>
    </AuthFormContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },
  locationStep: {
    gap: Spacing.lg,
  },
  metrics: {
    gap: Spacing.md,
  },
  actions: {
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
});
