import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { ProgramDashboardCard } from '@/components/program/ProgramDashboardCard';
import { WorkoutCalendar } from '@/components/program/WorkoutCalendar';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { trainingService } from '@/services/trainingService';
import type { PlannedWorkout, ProgramDashboard } from '@/types';

function monthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 7);
  const to = new Date(now);
  to.setDate(to.getDate() + 28);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export default function ProgramScreen() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<ProgramDashboard | null>(null);
  const [workouts, setWorkouts] = useState<PlannedWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [adapting, setAdapting] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { from, to } = monthRange();
    const [dashResult, plannedResult] = await Promise.all([
      trainingService.getDashboard(user.id),
      trainingService.getPlannedWorkouts(user.id, from, to),
    ]);
    if (dashResult.success) setDashboard(dashResult.data);
    if (plannedResult.success) setWorkouts(plannedResult.data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdapt() {
    if (!user) return;
    setAdapting(true);
    await trainingService.adaptProgram(user.id);
    setAdapting(false);
    load();
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={LiftFlowColors.accent} />
      </View>
    );
  }

  return (
    <ScreenContainer>
      <Pressable onPress={() => router.back()}>
        <AppText variant="body" color="accent">
          ← Back
        </AppText>
      </Pressable>

      <AppText variant="title" style={styles.title}>
        Training Program
      </AppText>

      <ProgramDashboardCard dashboard={dashboard} onAdapt={handleAdapt} adapting={adapting} />

      <SectionHeader title="This Week" subtitle="Tap workout to reschedule" />
      <WorkoutCalendar workouts={workouts} view="week" onReschedule={load} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: Spacing.lg, marginBottom: Spacing.xl },
});
