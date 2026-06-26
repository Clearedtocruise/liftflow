import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { MANUAL_CARDIO_OPTIONS, SPORTS_ACTIVITIES } from '@/constants/activityOptions';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useUnits } from '@/hooks/useUnits';
import { estimateActivityCalories, formatCalorieEstimate } from '@/lib/activityCalories';
import { cardioService } from '@/services/cardioService';
import type { CardioType } from '@/types/common';

export default function LogActivityScreen() {
  const { kind = 'cardio', activity: activityParam } = useLocalSearchParams<{
    kind?: string;
    activity?: string;
  }>();
  const { user } = useAuth();
  const units = useUnits();
  const [selectedId, setSelectedId] = useState<string | null>(activityParam ?? null);
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [distance, setDistance] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [notes, setNotes] = useState('');
  const [logging, setLogging] = useState(false);

  useEffect(() => {
    if (kind === 'walk') {
      router.replace('/(features)/cardio-tracking?activity=walk');
      return;
    }
    if (activityParam === 'run') {
      router.replace('/(features)/cardio-tracking?activity=steady-run');
      return;
    }
    if (activityParam === 'bike') {
      router.replace('/(features)/cardio-tracking?activity=steady-bike');
    }
  }, [activityParam, kind]);

  useEffect(() => {
    if (activityParam) {
      setSelectedId(activityParam);
    }
  }, [activityParam]);

  const isSport = kind === 'sport';
  const options = isSport ? SPORTS_ACTIVITIES : MANUAL_CARDIO_OPTIONS;
  const preselected = Boolean(activityParam) || kind === 'mobility';
  const selectedOption = options.find((option) => option.id === selectedId);
  const screenTitle = selectedOption ? `Log ${selectedOption.label}` : isSport ? 'Log Sport' : 'Log Activity';

  const durationSeconds = Math.max(1, Math.round(Number.parseFloat(durationMinutes) * 60));
  const distanceKm = distance.trim() ? units.parseDistance(distance) : undefined;
  const distanceMeters = distanceKm != null ? Math.round(distanceKm * 1000) : undefined;

  const calorieEstimate = useMemo(() => {
    if (!selectedId || !Number.isFinite(durationSeconds)) return null;
    if (isSport) {
      const sport = SPORTS_ACTIVITIES.find((s) => s.id === selectedId);
      return estimateActivityCalories({
        durationSeconds,
        weightKg: user?.weightKg,
        sportId: selectedId,
        intensity: sport?.intensity,
      });
    }
    const cardio = MANUAL_CARDIO_OPTIONS.find((c) => c.id === selectedId);
    return estimateActivityCalories({
      durationSeconds,
      weightKg: user?.weightKg,
      cardioType: cardio?.cardioType ?? 'other',
      distanceMeters,
    });
  }, [selectedId, durationSeconds, distanceMeters, isSport, user?.weightKg]);

  async function handleLog() {
    if (!user || !selectedId) {
      Alert.alert('Select activity', 'Choose an activity type first.');
      return;
    }
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
      if (kind === 'mobility') activityKind = 'mobility';
    }

    const estimate = calorieEstimate ?? estimateActivityCalories({ durationSeconds, weightKg: user.weightKg });

    const result = await cardioService.logSession({
      userId: user.id,
      cardioType,
      durationSeconds,
      distanceMeters,
      caloriesBurned: estimate.calories,
      avgHeartRate: heartRate.trim() ? Number.parseInt(heartRate, 10) : undefined,
      notes: notes.trim() || selectedOption?.label,
      activityKind,
      sportId,
      intensity,
      metadata: {
        met: estimate.met,
        estimatedCalories: true,
        weightKgUsed: estimate.weightKg,
      },
    });

    setLogging(false);
    if (result.success) {
      Alert.alert(
        'Activity logged',
        `${formatCalorieEstimate(estimate.calories, !user.weightKg)} · saved to your week.`,
      );
      router.back();
    } else {
      Alert.alert('Error', result.error);
    }
  }

  if (kind === 'walk' || activityParam === 'run' || activityParam === 'bike') {
    return null;
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="headline">{screenTitle}</AppText>
        <AppText variant="body" color="textSecondary">
          Duration counts toward recovery load. Calories are estimated from your weight and activity type.
        </AppText>

        {!preselected ? (
          <Card style={styles.section}>
            <AppText variant="label" color="textSecondary">
              Activity
            </AppText>
            <View style={styles.chips}>
              {options.map((option) => (
                <PrimaryButton
                  key={option.id}
                  label={option.label}
                  variant={selectedId === option.id ? 'primary' : 'secondary'}
                  onPress={() => {
                    if (option.id === 'walk') {
                      router.push('/(features)/cardio-tracking?activity=walk');
                      return;
                    }
                    if (option.id === 'run') {
                      router.push('/(features)/cardio-tracking?activity=steady-run');
                      return;
                    }
                    if (option.id === 'bike') {
                      router.push('/(features)/cardio-tracking?activity=steady-bike');
                      return;
                    }
                    setSelectedId(option.id);
                  }}
                />
              ))}
            </View>
          </Card>
        ) : selectedOption ? (
          <Card style={styles.section}>
            <AppText variant="label" color="textSecondary">
              Activity
            </AppText>
            <AppText variant="bodyBold">{selectedOption.label}</AppText>
          </Card>
        ) : null}

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
          {!isSport ? (
            <>
              <AppText variant="label" color="textSecondary">
                Distance ({units.preferredDistanceUnit}, optional)
              </AppText>
              <TextInput
                style={styles.input}
                value={distance}
                onChangeText={setDistance}
                keyboardType="decimal-pad"
                placeholderTextColor={LiftFlowColors.textTertiary}
              />
            </>
          ) : null}
          {calorieEstimate ? (
            <AppText variant="body" color="accent">
              {formatCalorieEstimate(calorieEstimate.calories, !user?.weightKg)}
            </AppText>
          ) : null}
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
