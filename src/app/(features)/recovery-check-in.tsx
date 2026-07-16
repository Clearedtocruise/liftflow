import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';

import { RecoveryCheckInForm } from '@/components/coaching/RecoveryCheckInForm';
import { RecoveryScoreCard } from '@/components/coaching/RecoveryScoreCard';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { Spacing } from '@/constants/theme';
import { usePlanAdjustment } from '@/contexts/PlanAdjustmentContext';
import { useAuth } from '@/hooks/useAuth';
import { recoveryService } from '@/services/recoveryService';
import type { DailyRecoveryCheckIn, RecoveryTrendPoint } from '@/types/coaching';

export default function RecoveryCheckInScreen() {
  const { user } = useAuth();
  const { bumpRevision } = usePlanAdjustment();
  const [checkIn, setCheckIn] = useState<DailyRecoveryCheckIn | null>(null);
  const [trend, setTrend] = useState<RecoveryTrendPoint[]>([]);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [todayResult, trendResult] = await Promise.all([
      recoveryService.getToday(user.id),
      recoveryService.getTrend(user.id),
    ]);
    if (todayResult.success) setCheckIn(todayResult.data);
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

      {checkIn && !editing ? (
        <>
          <AppText variant="body" color="textSecondary" style={styles.done}>
            You’re checked in for today. Coach is using this score for today’s training and nutrition.
          </AppText>
          <PrimaryButton label="Update check-in" variant="secondary" onPress={() => setEditing(true)} />
        </>
      ) : (
        <RecoveryCheckInForm
          userId={user.id}
          onComplete={(result) => {
            setCheckIn(result);
            setEditing(false);
            bumpRevision();
            void load();
            Alert.alert('Recovery logged', `Score: ${result.recoveryScore} — ${result.dailyRecommendation}`, [
              { text: 'Done', onPress: () => router.back() },
            ]);
          }}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: Spacing.lg, marginBottom: Spacing.xxl },
  done: { marginBottom: Spacing.md },
});
