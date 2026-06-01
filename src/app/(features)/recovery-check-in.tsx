import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';

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
    <ScreenContainer>
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
          Alert.alert('Recovery logged', `Score: ${result.recoveryScore} — ${result.dailyRecommendation}`);
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: Spacing.lg, marginBottom: Spacing.xxl },
});
