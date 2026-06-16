import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { weeklyCloseoutService } from '@/services/weeklyCloseoutService';
import type { WeeklyCloseoutRecord } from '@/types/weeklyCloseout';

export default function NextWeekPlanScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [record, setRecord] = useState<WeeklyCloseoutRecord | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const result = await weeklyCloseoutService.getStatus(user.id);
    if (result.success && result.data) {
      setRecord(result.data);
    } else {
      const prepared = await weeklyCloseoutService.prepare(user.id);
      if (prepared.success) setRecord(prepared.data);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAccept() {
    if (!user || !record) return;
    setAccepting(true);
    const result = await weeklyCloseoutService.accept(user.id, record.id);
    setAccepting(false);
    if (result.success) {
      Alert.alert('Plan accepted', 'Next week is ready. Your completed week is archived.');
      router.back();
    } else {
      Alert.alert('Error', result.error);
    }
  }

  async function handleRegenerate() {
    if (!user) return;
    setLoading(true);
    const result = await weeklyCloseoutService.prepare(user.id);
    if (result.success) setRecord(result.data);
    setLoading(false);
  }

  if (loading) {
    return (
      <ScreenContainer>
        <ActivityIndicator color={LiftFlowColors.accent} />
      </ScreenContainer>
    );
  }

  if (!record) {
    return (
      <ScreenContainer>
        <AppText variant="body" color="textSecondary">
          Next week plan unavailable.
        </AppText>
      </ScreenContainer>
    );
  }

  const plan = record.nextWeekPlan;

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="headline">Next Week Plan</AppText>
        <AppText variant="caption" color="textSecondary">
          {plan.weekStartDate} — {plan.weekEndDate}
        </AppText>
        <AppText variant="bodyBold" color="accent">
          Focus: {plan.focus}
        </AppText>

        <Card style={styles.section}>
          <AppText variant="title">Workouts</AppText>
          {plan.workoutDays.map((day) => (
            <View key={day.date} style={styles.row}>
              <AppText variant="bodyBold">
                {day.dayLabel}: {day.title}
              </AppText>
              <AppText variant="caption" color="textSecondary">
                {day.muscleGroups.join(' · ') || 'Recovery'} · {day.exerciseCount} exercises
              </AppText>
            </View>
          ))}
        </Card>

        <Card style={styles.section}>
          <AppText variant="title">Nutrition</AppText>
          <AppText variant="body">
            Daily targets: {plan.nutrition.dailyCalories} cal · {plan.nutrition.dailyProteinG}g protein
          </AppText>
          <AppText variant="footnote" color="textSecondary">
            {plan.nutrition.coachSummary}
          </AppText>
          {plan.nutrition.days.map((day) => (
            <AppText key={day.day} variant="caption" color="textSecondary">
              {day.day}: {day.calories} cal · {day.proteinG}g protein — {day.label}
            </AppText>
          ))}
        </Card>

        <View style={styles.actions}>
          <PrimaryButton label="Accept Plan" onPress={handleAccept} loading={accepting} />
          <PrimaryButton label="Regenerate Plans" onPress={handleRegenerate} variant="secondary" />
          <PrimaryButton label="Adjust in Workout Tab" onPress={() => router.push('/(tabs)/workout')} variant="ghost" />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.lg, paddingBottom: Spacing.huge },
  section: { gap: Spacing.sm },
  row: { gap: Spacing.xs, paddingVertical: Spacing.xs },
  actions: { gap: Spacing.sm },
});
