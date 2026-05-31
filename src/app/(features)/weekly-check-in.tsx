import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useUnits } from '@/hooks/useUnits';
import { coachCheckInService } from '@/services/coachCheckInService';
import type { WeeklyCoachCheckIn } from '@/types/coaching';

export default function WeeklyCheckInScreen() {
  const { user } = useAuth();
  const units = useUnits();
  const [history, setHistory] = useState<WeeklyCoachCheckIn[]>([]);
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [compliance, setCompliance] = useState('');
  const [energy, setEnergy] = useState('');
  const [sleep, setSleep] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const result = await coachCheckInService.getTrend(user.id);
    if (result.success) setHistory(result.data);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit() {
    if (!user) return;
    setSubmitting(true);
    const result = await coachCheckInService.submit(user.id, {
      weightKg: units.parseWeight(weight),
      waistCm: units.parseMeasurement(waist),
      compliancePct: compliance ? parseFloat(compliance) : undefined,
      energyScore: energy ? parseInt(energy, 10) : undefined,
      sleepScore: sleep ? parseInt(sleep, 10) : undefined,
    });
    setSubmitting(false);

    if (result.success) {
      Alert.alert('Weekly check-in saved', result.data.recommendations.join('\n'));
      load();
    } else {
      Alert.alert('Error', result.error);
    }
  }

  const latest = history[0];

  return (
    <ScreenContainer>
      <Pressable onPress={() => router.back()}>
        <AppText variant="body" color="accent">
          ← Back
        </AppText>
      </Pressable>

      <AppText variant="title" style={styles.title}>
        Weekly Coach Check-in
      </AppText>

      {latest ? (
        <Card style={styles.latest}>
          <AppText variant="bodyBold">Last week</AppText>
          <AppText variant="footnote" color="textSecondary">
            Weight {latest.weightKg != null ? units.formatWeight(latest.weightKg) : '—'} · Compliance {latest.compliancePct ?? '—'}%
          </AppText>
          {latest.recommendations.map((rec) => (
            <AppText key={rec} variant="footnote" color="textSecondary">
              • {rec}
            </AppText>
          ))}
        </Card>
      ) : null}

      <Card style={styles.form}>
        <Field label={`Weight (${units.weightLabel})`} value={weight} onChange={setWeight} />
        <Field label={`Waist (${units.measurementLabel})`} value={waist} onChange={setWaist} />
        <Field label="Compliance %" value={compliance} onChange={setCompliance} />
        <Field label="Energy (1–10)" value={energy} onChange={setEnergy} />
        <Field label="Sleep (1–10)" value={sleep} onChange={setSleep} />
        <PrimaryButton label="Submit Weekly Check-in" onPress={handleSubmit} loading={submitting} />
      </Card>
    </ScreenContainer>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.field}>
      <AppText variant="caption" color="textSecondary">
        {label}
      </AppText>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        value={value}
        onChangeText={onChange}
        placeholderTextColor={LiftFlowColors.textTertiary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: Spacing.lg, marginBottom: Spacing.xxl },
  latest: { gap: Spacing.sm, marginBottom: Spacing.xl },
  form: { gap: Spacing.md },
  field: { gap: Spacing.xs },
  input: {
    backgroundColor: LiftFlowColors.background,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    color: LiftFlowColors.textPrimary,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
});
