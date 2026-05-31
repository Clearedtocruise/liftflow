import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import type { DailyWorkoutRecommendation, WeeklyPlanDay, WorkoutRecommendationReport } from '@/types/workoutRecommendation';

type WorkoutRecommendationPanelProps = {
  report: WorkoutRecommendationReport;
  compact?: boolean;
};

export function WorkoutRecommendationPanel({ report, compact = false }: WorkoutRecommendationPanelProps) {
  const { today, tomorrow, weeklyPlan, context } = report;

  return (
    <View style={styles.wrap}>
      <Card style={styles.card}>
        <AppText variant="caption" color="accent">
          {context.splitLabel} · Recovery {context.recoveryScore}
        </AppText>
        <AppText variant="bodyBold">{today.isRestDay ? 'Rest Day' : today.workout?.name ?? today.sessionLabel ?? 'Today'}</AppText>
        <AppText variant="footnote" color="textSecondary">
          {context.trainingRecommendation.replace(/_/g, ' ')} · {context.adherencePct}% adherence · {context.workoutsLast7d} sessions (7d)
        </AppText>
        <DayBlock label="Today" day={today} />
        {!compact ? <DayBlock label="Tomorrow" day={tomorrow} /> : null}
      </Card>

      {!compact ? (
        <>
          <Card style={styles.card}>
            <AppText variant="bodyBold">Why this workout</AppText>
            {today.whySelected.map((line) => (
              <AppText key={line} variant="footnote" color="textSecondary">
                • {line}
              </AppText>
            ))}
          </Card>

          {today.whyNotSelected.length > 0 ? (
            <Card style={styles.card}>
              <AppText variant="bodyBold">Why not other muscles</AppText>
              {today.whyNotSelected.map((item) => (
                <View key={item.muscle} style={styles.explainRow}>
                  <AppText variant="footnote" color="textSecondary">
                    {item.muscle}
                  </AppText>
                  <AppText variant="footnote" color="textTertiary" style={styles.explainReason}>
                    {item.reason}
                  </AppText>
                </View>
              ))}
            </Card>
          ) : null}

          <Card style={styles.card}>
            <AppText variant="bodyBold">Weekly plan</AppText>
            {weeklyPlan.map((day) => (
              <WeeklyRow key={day.date} day={day} />
            ))}
          </Card>
        </>
      ) : null}
    </View>
  );
}

function DayBlock({ label, day }: { label: string; day: DailyWorkoutRecommendation }) {
  return (
    <View style={styles.dayBlock}>
      <AppText variant="caption" color="textTertiary">
        {label} · {day.dayLabel}
      </AppText>
      {day.isRestDay ? (
        <AppText variant="footnote" color="textSecondary">
          Rest
        </AppText>
      ) : day.workout ? (
        <>
          {day.workout.exercises.slice(0, compactLimit(day)).map((ex) => (
            <AppText key={ex.name} variant="footnote" color="textSecondary">
              {ex.name}: {ex.sets}×{ex.reps}
              {ex.weightLbs ? ` @ ${ex.weightLbs} lb` : ''}
            </AppText>
          ))}
          {day.workout.exercises.length > 3 ? (
            <AppText variant="caption" color="textTertiary">
              +{day.workout.exercises.length - 3} more · ~{day.workout.estimatedMinutes} min
            </AppText>
          ) : null}
        </>
      ) : (
        <AppText variant="footnote" color="textSecondary">
          {day.targetMuscles.join(', ')}
        </AppText>
      )}
    </View>
  );
}

function compactLimit(day: DailyWorkoutRecommendation): number {
  return day.workout ? 3 : 0;
}

function WeeklyRow({ day }: { day: WeeklyPlanDay }) {
  return (
    <View style={styles.weekRow}>
      <AppText variant="footnote" color="textSecondary" style={styles.weekDay}>
        {day.dayLabel.slice(0, 3)}
      </AppText>
      <AppText variant="footnote" style={styles.weekSession}>
        {day.isRestDay ? 'Rest' : day.sessionLabel ?? day.targetMuscles.join(', ')}
      </AppText>
      {day.estimatedMinutes ? (
        <AppText variant="caption" color="textTertiary">
          {day.estimatedMinutes}m
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md },
  card: { gap: Spacing.sm },
  dayBlock: { gap: Spacing.xs, marginTop: Spacing.sm },
  explainRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  explainReason: { flex: 1 },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LiftFlowColors.border,
  },
  weekDay: { width: 36 },
  weekSession: { flex: 1 },
});
