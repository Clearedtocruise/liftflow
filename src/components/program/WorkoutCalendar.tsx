import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { usePlanAdjustment } from '@/contexts/PlanAdjustmentContext';
import { localDateString } from '@/lib/localDate';
import { trainingService } from '@/services/trainingService';
import type { PlannedWorkout } from '@/types';

type WorkoutCalendarProps = {
  userId: string;
  workouts: PlannedWorkout[];
  view?: 'week' | 'month';
  onReschedule?: () => void;
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function weekStart(date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(12, 0, 0, 0);
  return d;
}

function formatDate(d: Date): string {
  return localDateString(d);
}

function statusColor(status: string, dateStr: string): string {
  const today = localDateString();
  if (status === 'completed') return LiftFlowColors.accent;
  if (status === 'planned' && dateStr < today) return LiftFlowColors.restTimer;
  if (status === 'cancelled') return LiftFlowColors.textTertiary;
  return LiftFlowColors.textSecondary;
}

export function WorkoutCalendar({ userId, workouts, view = 'week', onReschedule }: WorkoutCalendarProps) {
  const { setFromAdaptation } = usePlanAdjustment();
  const [anchor, setAnchor] = useState(new Date());
  const [busy, setBusy] = useState(false);
  const start = weekStart(anchor);
  const days = useMemo(() => {
    const count = view === 'month' ? 28 : 7;
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return formatDate(d);
    });
  }, [start, view]);

  const byDate = useMemo(() => {
    const map = new Map<string, PlannedWorkout[]>();
    for (const w of workouts) {
      const list = map.get(w.scheduledDate) ?? [];
      list.push(w);
      map.set(w.scheduledDate, list);
    }
    return map;
  }, [workouts]);

  async function adaptChange(change: import('@/types/planAdaptation').ScheduleChange) {
    setBusy(true);
    const result = await trainingService.adaptScheduleChange(userId, change);
    setBusy(false);
    if (result.success) {
      setFromAdaptation(result.data);
      onReschedule?.();
    } else {
      Alert.alert('Could not adjust plan', result.error);
    }
  }

  async function moveWorkout(workout: PlannedWorkout, deltaDays: number) {
    const d = new Date(workout.scheduledDate + 'T12:00:00');
    d.setDate(d.getDate() + deltaDays);
    await adaptChange({ type: 'move', workoutId: workout.id, toDate: formatDate(d) });
  }

  async function skipWorkout(workout: PlannedWorkout) {
    await adaptChange({ type: 'skip', workoutId: workout.id });
  }

  async function swapWorkouts(source: PlannedWorkout, target: PlannedWorkout) {
    await adaptChange({ type: 'swap', workoutIdA: source.id, workoutIdB: target.id });
  }

  function promptSwap(source: PlannedWorkout) {
    const others = workouts.filter((w) => w.id !== source.id && w.status === 'planned');
    if (others.length === 0) {
      Alert.alert('No swap target', 'No other planned workouts available to swap with.');
      return;
    }
    Alert.alert('Swap with', 'Choose a workout to exchange days with', [
      ...others.map((w) => ({
        text: `${w.metadata?.slotLabel ?? w.name} (${w.scheduledDate.slice(5)})`,
        onPress: () => swapWorkouts(source, w),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }

  function confirmSkip(workout: PlannedWorkout) {
    Alert.alert('Skip workout?', `${workout.name} will become a recovery day. Nutrition updates automatically.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Skip', style: 'destructive', onPress: () => skipWorkout(workout) },
    ]);
  }

  function handleWorkoutPress(workout: PlannedWorkout) {
    if (busy || workout.status !== 'planned') return;
    Alert.alert(workout.name, 'Adjust this workout? Training and nutrition update automatically.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Swap days', onPress: () => promptSwap(workout) },
      { text: 'Skip', style: 'destructive', onPress: () => confirmSkip(workout) },
      { text: '+1 day', onPress: () => moveWorkout(workout, 1) },
      { text: '+2 days', onPress: () => moveWorkout(workout, 2) },
      { text: '−1 day', onPress: () => moveWorkout(workout, -1) },
    ]);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.nav}>
        <Pressable onPress={() => setAnchor(new Date(anchor.getTime() - 7 * 86400000))}>
          <AppText variant="body" color="accent">
            ← Prev
          </AppText>
        </Pressable>
        <AppText variant="bodyBold">{view === 'week' ? 'Week' : '4 Weeks'}</AppText>
        <Pressable onPress={() => setAnchor(new Date(anchor.getTime() + 7 * 86400000))}>
          <AppText variant="body" color="accent">
            Next →
          </AppText>
        </Pressable>
      </View>

      <View style={styles.grid}>
        {days.map((dateStr, index) => {
          const dayWorkouts = byDate.get(dateStr) ?? [];
          const weekday = view === 'week' ? WEEKDAYS[index] : dateStr.slice(5);
          return (
            <Card key={dateStr} style={styles.dayCard}>
              <AppText variant="caption" color="textSecondary">
                {weekday}
              </AppText>
              <AppText variant="footnote" color="textTertiary">
                {dateStr.slice(5)}
              </AppText>
              {dayWorkouts.length === 0 ? (
                <AppText variant="caption" color="textTertiary">
                  Rest
                </AppText>
              ) : (
                dayWorkouts.map((w) => (
                  <Pressable key={w.id} onPress={() => handleWorkoutPress(w)} style={styles.workoutChip}>
                    <View style={[styles.dot, { backgroundColor: statusColor(w.status, w.scheduledDate) }]} />
                    <AppText variant="caption" numberOfLines={2}>
                      {w.metadata?.slotLabel ?? w.name}
                    </AppText>
                  </Pressable>
                ))
              )}
            </Card>
          );
        })}
      </View>

      <AppText variant="footnote" color="textTertiary">
        Tap a workout to move, swap, or skip — nutrition and coach messaging update automatically.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  dayCard: { width: '13.5%', minWidth: 72, gap: Spacing.xs, padding: Spacing.sm },
  workoutChip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  dot: { width: 6, height: 6, borderRadius: Radius.full },
});
