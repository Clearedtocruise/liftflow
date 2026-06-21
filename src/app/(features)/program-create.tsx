import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useWorkoutLocations } from '@/hooks/useWorkoutLocations';
import { trainingService } from '@/services/trainingService';
import type { CreateProgramPayload, ProgramFrequency, ProgramType } from '@/types';

const PROGRAM_TYPES: { id: ProgramType; label: string }[] = [
  { id: 'push_pull_legs', label: 'Push Pull Legs' },
  { id: 'upper_lower', label: 'Upper Lower' },
  { id: 'full_body', label: 'Full Body' },
  { id: 'body_part_split', label: 'Body Part Split' },
  { id: 'strength', label: 'Strength' },
];

const FREQUENCIES: ProgramFrequency[] = [3, 4, 5, 6, 7, 'custom'];
const GOALS = ['muscle_gain', 'fat_loss', 'strength', 'general_fitness'];
const EXPERIENCE = ['beginner', 'intermediate', 'advanced'];

const CUSTOM_DAYS = ['Push', 'Pull', 'Legs', 'Rest', 'Rest', 'Rest', 'Rest'];

export default function ProgramCreateScreen() {
  const { user } = useAuth();
  const { locations, selectedId, setSelectedId } = useWorkoutLocations(user?.id);
  const [programType, setProgramType] = useState<ProgramType>('push_pull_legs');
  const [frequency, setFrequency] = useState<ProgramFrequency>(4);
  const [goal, setGoal] = useState('muscle_gain');
  const [experience, setExperience] = useState('intermediate');
  const [customDays, setCustomDays] = useState(CUSTOM_DAYS);
  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    if (!user) return;
    setGenerating(true);

    const location = locations.find((l) => l.id === selectedId);
    const payload: CreateProgramPayload = {
      programType,
      frequency,
      goal,
      experience,
      durationWeeks: 12,
      equipment: location?.availableEquipment?.length
        ? location.availableEquipment
        : user.availableEquipment,
      locationId: location?.id,
      locationName: location?.name,
      customSchedule: frequency === 'custom' ? customDays : undefined,
    };

    const result = await trainingService.generateProgram(user.id, payload);
    setGenerating(false);

    if (result.success) {
      Alert.alert('Program created', `${result.data?.program.name ?? 'Program'} — ${result.data?.totalPlanned ?? 0} workouts scheduled`, [
        { text: 'View Program', onPress: () => router.replace('/(features)/program') },
      ]);
    } else {
      Alert.alert('Error', result.error);
    }
  }

  return (
    <ScreenContainer>
      <Pressable onPress={() => router.back()}>
        <AppText variant="body" color="accent">
          ← Back
        </AppText>
      </Pressable>

      <AppText variant="title" style={styles.title}>
        Create Program
      </AppText>

      <Section title="Program Type">
        <ChipRow
          options={PROGRAM_TYPES.map((p) => ({ id: p.id, label: p.label }))}
          value={programType}
          onChange={(v) => setProgramType(v as ProgramType)}
        />
      </Section>

      <Section title="Lifting days per week">
        <ChipRow
          options={[
            ...FREQUENCIES.filter((f) => f !== 'custom').map((f) => ({
              id: String(f),
              label: `${f} lift days`,
            })),
            { id: 'custom', label: 'Custom' },
          ]}
          value={String(frequency)}
          onChange={(v) => setFrequency(v === 'custom' ? 'custom' : (parseInt(v, 10) as ProgramFrequency))}
        />
      </Section>

      {frequency === 'custom' ? (
        <Section title="Custom Week (Mon–Sun)">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {customDays.map((day, index) => (
              <Pressable
                key={index}
                style={styles.chip}
                onPress={() => {
                  const options = ['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full Body', 'Rest'];
                  const next = options[(options.indexOf(day) + 1) % options.length];
                  setCustomDays(customDays.map((d, i) => (i === index ? next : d)));
                }}>
                <AppText variant="caption">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index]}: {day}
                </AppText>
              </Pressable>
            ))}
          </ScrollView>
        </Section>
      ) : null}

      <Section title="Goal">
        <ChipRow options={GOALS.map((g) => ({ id: g, label: g.replace('_', ' ') }))} value={goal} onChange={setGoal} />
      </Section>

      <Section title="Experience">
        <ChipRow options={EXPERIENCE.map((e) => ({ id: e, label: e }))} value={experience} onChange={setExperience} />
      </Section>

      {locations.length > 0 ? (
        <Section title="Training Location">
          <ChipRow
            options={locations.map((l) => ({ id: l.id, label: l.name }))}
            value={selectedId ?? locations[0]?.id ?? ''}
            onChange={setSelectedId}
          />
        </Section>
      ) : null}

      <Card style={styles.note}>
        <AppText variant="footnote" color="textSecondary">
          Program includes 12 weeks with automatic phases (accumulation → intensification → deload → peak → recovery),
          progression from your history, and adaptations for recovery score and limitations.
        </AppText>
      </Card>

      <PrimaryButton label={generating ? 'Generating…' : 'Generate Program'} onPress={handleGenerate} loading={generating} />
    </ScreenContainer>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="subhead" color="textSecondary">
        {title}
      </AppText>
      {children}
    </View>
  );
}

function ChipRow({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {options.map((opt) => (
        <Pressable
          key={opt.id}
          style={[styles.chip, value === opt.id && styles.chipActive]}
          onPress={() => onChange(opt.id)}>
          <AppText variant="caption" color={value === opt.id ? 'accent' : 'textSecondary'}>
            {opt.label}
          </AppText>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { marginVertical: Spacing.lg },
  section: { gap: Spacing.sm, marginBottom: Spacing.lg },
  chipRow: { gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: LiftFlowColors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.border,
  },
  chipActive: { borderColor: LiftFlowColors.accentMuted, backgroundColor: LiftFlowColors.accentGlow },
  note: { marginBottom: Spacing.xl },
});
