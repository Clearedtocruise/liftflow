import { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { recoveryService } from '@/services/recoveryService';
import type { DailyRecoveryCheckIn } from '@/types/coaching';

type RecoveryCheckInFormProps = {
  userId: string;
  onComplete?: (checkIn: DailyRecoveryCheckIn) => void;
};

function ScaleInput({
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
        placeholder="1–10"
        placeholderTextColor={LiftFlowColors.textTertiary}
        value={value}
        onChangeText={onChange}
      />
    </View>
  );
}

export function RecoveryCheckInForm({ userId, onComplete }: RecoveryCheckInFormProps) {
  const [sleepHours, setSleepHours] = useState('');
  const [sleepQuality, setSleepQuality] = useState('');
  const [energyLevel, setEnergyLevel] = useState('');
  const [stressLevel, setStressLevel] = useState('');
  const [sorenessLevel, setSorenessLevel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    const result = await recoveryService.submitCheckIn(userId, {
      sleepHours: sleepHours ? parseFloat(sleepHours) : undefined,
      sleepQuality: sleepQuality ? parseInt(sleepQuality, 10) : undefined,
      energyLevel: energyLevel ? parseInt(energyLevel, 10) : undefined,
      stressLevel: stressLevel ? parseInt(stressLevel, 10) : undefined,
      sorenessLevel: sorenessLevel ? parseInt(sorenessLevel, 10) : undefined,
    });
    setSubmitting(false);

    if (result.success) {
      onComplete?.(result.data);
    } else {
      Alert.alert('Check-in failed', result.error);
    }
  }

  return (
    <Card style={styles.card}>
      <AppText variant="bodyBold">Daily Recovery Check-in</AppText>
      <ScaleInput label="Sleep hours" value={sleepHours} onChange={setSleepHours} />
      <View style={styles.row}>
        <ScaleInput label="Sleep quality (1–10)" value={sleepQuality} onChange={setSleepQuality} />
        <ScaleInput label="Energy (1–10)" value={energyLevel} onChange={setEnergyLevel} />
      </View>
      <View style={styles.row}>
        <ScaleInput label="Stress (1–10)" value={stressLevel} onChange={setStressLevel} />
        <ScaleInput label="Soreness (1–10)" value={sorenessLevel} onChange={setSorenessLevel} />
      </View>
      <PrimaryButton label="Submit Check-in" onPress={handleSubmit} loading={submitting} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.md },
  field: { gap: Spacing.xs, flex: 1 },
  row: { flexDirection: 'row', gap: Spacing.md },
  input: {
    backgroundColor: LiftFlowColors.background,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    color: LiftFlowColors.textPrimary,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
});
