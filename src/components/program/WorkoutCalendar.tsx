import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { trainingService } from '@/services/trainingService';
import type { PlannedWorkout } from '@/types';

type WorkoutCalendarProps = {
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
  return d.toISOString().slice(0, 10);
}

function statusColor(status: string, dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (status === 'completed') return LiftFlowColors.accent;
  if (status === 'planned' && dateStr < today) return LiftFlowColors.restTimer;
  if (status === 'cancelled') return LiftFlowColors.textTertiary;
  return LiftFlowColors.textSecondary;
}

export function WorkoutCalendar({ workouts, view = 'week', onReschedule }: WorkoutCalendarProps) {
  const [anchor, setAnchor] = useState(new Date());
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

  async function moveWorkout(workout: PlannedWorkout, deltaDays: number) {
    const d = new Date(workout.scheduledDate + 'T12:00:00');
    d.setDate(d.getDate() + deltaDays);
    const newDate = formatDate(d);
    const result = await trainingService.rescheduleWorkout(workout.id, newDate);
    if (result.success) onReschedule?.();
    else Alert.alert('Could not reschedule', result.error);
  }

  function handleWorkoutPress(workout: PlannedWorkout) {
    Alert.alert(workout.name, 'Reschedule this workout?', [
      { text: 'Cancel', style: 'cancel' },
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
        Tap a workout to reschedule (+/− days). Green = completed, blue = missed.
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
