import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { LogMeasurementForm } from '@/components/body/LogMeasurementForm';
import { RecoveryCheckInForm } from '@/components/coaching/RecoveryCheckInForm';
import { RecoveryScoreCard } from '@/components/coaching/RecoveryScoreCard';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { recoveryService } from '@/services/recoveryService';
import type { DailyRecoveryCheckIn, RecoveryTrendPoint } from '@/types/coaching';

export default function RecoveryCheckInScreen() {
  const { user } = useAuth();
  const [checkIn, setCheckIn] = useState<DailyRecoveryCheckIn | null>(null);
  const [trend, setTrend] = useState<RecoveryTrendPoint[]>([]);
  const [showMeasurement, setShowMeasurement] = useState(false);
  const [measurementSaved, setMeasurementSaved] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [todayResult, trendResult] = await Promise.all([
      recoveryService.getToday(user.id),
      recoveryService.getTrend(user.id),
    ]);
    if (todayResult.success && todayResult.data) setCheckIn(todayResult.data);
    if (trendResult.success) setTrend(trendResult.data);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  if (!user) return null;

  return (
    <ScreenContainer keyboardAvoiding>
      <Pressable onPress={() => router.back()}>
        <AppText variant="body" color="accent">
          ← Back
        </AppText>
      </Pressable>

      <AppText variant="title" style={styles.title}>
        Recovery Check-in
      </AppText>

      <RecoveryScoreCard checkIn={checkIn} trend={trend} />
      <RecoveryCheckInForm
        userId={user.id}
        onComplete={(result) => {
          setCheckIn(result);
          load();
          router.replace('/(tabs)/dashboard');
        }}
      />

      <Pressable
        onPress={() => setShowMeasurement((value) => !value)}
        accessibilityRole="button"
        style={styles.measurementToggle}>
        <AppText variant="label" color="accent">
          {showMeasurement ? 'Hide measurement' : 'Log measurement'}
        </AppText>
      </Pressable>

      {showMeasurement ? (
        <LogMeasurementForm
          userId={user.id}
          subtitle="Weigh in while you check in — this drives your transformation timeline."
          onSaved={() => {
            setMeasurementSaved(true);
            setShowMeasurement(false);
          }}
        />
      ) : null}

      {measurementSaved ? (
        <AppText variant="caption" color="success" style={styles.savedNote}>
          Measurement saved — your Progress timeline is updated.
        </AppText>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: Spacing.lg, marginBottom: Spacing.xxl },
  measurementToggle: { marginTop: Spacing.lg },
  savedNote: { marginTop: Spacing.sm },
});
