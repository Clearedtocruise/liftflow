import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { WorkoutCalendar } from '@/components/program/WorkoutCalendar';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { trainingService } from '@/services/trainingService';
import type { PlannedWorkout } from '@/types';

export default function ProgramCalendarScreen() {
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState<PlannedWorkout[]>([]);
  const [view, setView] = useState<'week' | 'month'>('week');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const from = new Date();
    from.setDate(from.getDate() - 14);
    const to = new Date();
    to.setDate(to.getDate() + (view === 'month' ? 42 : 14));
    const result = await trainingService.getPlannedWorkouts(
      user.id,
      from.toISOString().slice(0, 10),
      to.toISOString().slice(0, 10),
    );
    if (result.success) setWorkouts(result.data);
    setLoading(false);
  }, [user, view]);

  useEffect(() => {
    load();
  }, [load]);

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
        Workout Calendar
      </AppText>

      <View style={styles.toggle}>
        <PrimaryButton label="Week" onPress={() => setView('week')} variant={view === 'week' ? 'primary' : 'secondary'} />
        <PrimaryButton label="Month" onPress={() => setView('month')} variant={view === 'month' ? 'primary' : 'secondary'} />
      </View>

      <WorkoutCalendar workouts={workouts} view={view} onReschedule={load} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: Spacing.lg, marginBottom: Spacing.lg },
  toggle: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
});
