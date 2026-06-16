import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { MANUAL_CARDIO_OPTIONS, SPORTS_ACTIVITIES } from '@/constants/activityOptions';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { parseDistanceToKm } from '@/lib/unitConversion';
import { cardioService } from '@/services/cardioService';
import type { CardioType } from '@/types/common';

export default function LogActivityScreen() {
  const { kind = 'cardio' } = useLocalSearchParams<{ kind?: string }>();
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [distance, setDistance] = useState('');
  const [calories, setCalories] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [notes, setNotes] = useState('');
  const [logging, setLogging] = useState(false);

  const isSport = kind === 'sport';
  const options = isSport ? SPORTS_ACTIVITIES : MANUAL_CARDIO_OPTIONS;

  async function handleLog() {
    if (!user || !selectedId) {
      Alert.alert('Select activity', 'Choose an activity type first.');
      return;
    }
    const durationSeconds = Math.max(1, Math.round(Number.parseFloat(durationMinutes) * 60));
    if (!Number.isFinite(durationSeconds)) {
      Alert.alert('Invalid duration', 'Enter duration in minutes.');
      return;
    }

    setLogging(true);
    let cardioType: CardioType = 'other';
    let activityKind: 'cardio' | 'sport' | 'mobility' | 'walk' = isSport ? 'sport' : 'cardio';
    let sportId: string | undefined;
    let intensity: 'low' | 'moderate' | 'high' | undefined;

    if (isSport) {
      const sport = SPORTS_ACTIVITIES.find((s) => s.id === selectedId);
      sportId = selectedId;
      intensity = sport?.intensity;
      cardioType = 'other';
    } else {
      const cardio = MANUAL_CARDIO_OPTIONS.find((c) => c.id === selectedId);
      cardioType = cardio?.cardioType ?? 'other';
      if (kind === 'walk') activityKind = 'walk';
      if (kind === 'mobility') activityKind = 'mobility';
    }

    const distanceKm = distance.trim() ? parseDistanceToKm(distance, 'mi') : undefined;

    const result = await cardioService.logSession({
      userId: user.id,
      cardioType,
      durationSeconds,
      distanceMeters: distanceKm != null ? Math.round(distanceKm * 1000) : undefined,
      caloriesBurned: calories.trim() ? Number.parseInt(calories, 10) : undefined,
      avgHeartRate: heartRate.trim() ? Number.parseInt(heartRate, 10) : undefined,
      notes: notes.trim() || undefined,
      activityKind,
      sportId,
      intensity,
    });

    setLogging(false);
    if (result.success) {
      Alert.alert('Activity logged', 'Recovery and weekly summaries will include this session.');
      router.back();
    } else {
      Alert.alert('Error', result.error);
    }
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="headline">{isSport ? 'Log Sport' : 'Log Activity'}</AppText>
        <AppText variant="body" color="textSecondary">
          Duration, distance, and intensity count toward recovery load.
        </AppText>

        <Card style={styles.section}>
          <AppText variant="label" color="textSecondary">
            Activity
          </AppText>
          <View style={styles.chips}>
            {options.map((option) => (
              <PrimaryButton
                key={option.id}
                label={'label' in option ? option.label : option.id}
                variant={selectedId === option.id ? 'primary' : 'secondary'}
                onPress={() => setSelectedId(option.id)}
              />
            ))}
          </View>
        </Card>

        <Card style={styles.section}>
          <AppText variant="label" color="textSecondary">
            Duration (minutes)
          </AppText>
          <TextInput
            style={styles.input}
            value={durationMinutes}
            onChangeText={setDurationMinutes}
            keyboardType="decimal-pad"
            placeholderTextColor={LiftFlowColors.textTertiary}
          />
          <AppText variant="label" color="textSecondary">
            Distance (mi, optional)
          </AppText>
          <TextInput
            style={styles.input}
            value={distance}
            onChangeText={setDistance}
            keyboardType="decimal-pad"
            placeholderTextColor={LiftFlowColors.textTertiary}
          />
          <AppText variant="label" color="textSecondary">
            Calories (optional)
          </AppText>
          <TextInput
            style={styles.input}
            value={calories}
            onChangeText={setCalories}
            keyboardType="number-pad"
            placeholderTextColor={LiftFlowColors.textTertiary}
          />
          <AppText variant="label" color="textSecondary">
            Avg heart rate (optional)
          </AppText>
          <TextInput
            style={styles.input}
            value={heartRate}
            onChangeText={setHeartRate}
            keyboardType="number-pad"
            placeholderTextColor={LiftFlowColors.textTertiary}
          />
          <AppText variant="label" color="textSecondary">
            Notes
          </AppText>
          <TextInput
            style={[styles.input, styles.notes]}
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholderTextColor={LiftFlowColors.textTertiary}
          />
        </Card>

        <PrimaryButton label="Log Activity" onPress={handleLog} loading={logging} size="large" />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.lg, paddingBottom: Spacing.huge },
  section: { gap: Spacing.sm },
  chips: { gap: Spacing.sm },
  input: {
    backgroundColor: LiftFlowColors.backgroundSecondary,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: LiftFlowColors.textPrimary,
    fontSize: 16,
  },
  notes: { minHeight: 80, textAlignVertical: 'top' },
});
