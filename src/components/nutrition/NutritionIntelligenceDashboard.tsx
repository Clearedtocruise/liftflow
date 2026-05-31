import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { coachingActionColor, coachingActionLabel, formatMl, weightTrendLabel } from '@/lib/nutritionIntelligenceEngine';
import type { NutritionIntelligenceReport } from '@/types/nutritionIntelligence';

type NutritionIntelligenceDashboardProps = {
  report: NutritionIntelligenceReport;
  compact?: boolean;
};

export function NutritionIntelligenceDashboard({ report, compact = false }: NutritionIntelligenceDashboardProps) {
  const { context, macroTargets, gapAnalysis, coachingTips, mealSuggestions, groceryList, weeklyPlan } = report;

  return (
    <View style={styles.wrap}>
      <Card style={styles.card}>
        <AppText variant="caption" color="accent">
          {context.goalLabel} · Recovery {context.recoveryScore} · {weightTrendLabel(context.weightTrend)}
        </AppText>
        <AppText variant="bodyBold">Today&apos;s Targets</AppText>
        <View style={styles.macroRow}>
          <MacroChip label="Cal" value={String(macroTargets.calories)} />
          <MacroChip label="Protein" value={`${macroTargets.proteinG}g`} />
          <MacroChip label="Carbs" value={`${macroTargets.carbsG}g`} />
          <MacroChip label="Fat" value={`${macroTargets.fatG}g`} />
        </View>
        <AppText variant="footnote" color="textSecondary">
          Hydration: {formatMl(macroTargets.hydrationMl)} · {context.adherencePct}% logging adherence
        </AppText>
        {context.upcomingWorkout?.isTrainingDay ? (
          <AppText variant="footnote" color="textTertiary">
            Training: {context.upcomingWorkout.name}
          </AppText>
        ) : (
          <AppText variant="footnote" color="textTertiary">
            Rest day nutrition
          </AppText>
        )}
      </Card>

      <Card style={styles.card}>
        <AppText variant="bodyBold">Remaining today</AppText>
        <AppText variant="footnote" color="textSecondary">
          {gapAnalysis.caloriesRemaining} kcal · {gapAnalysis.proteinRemainingG}g protein ·{' '}
          {gapAnalysis.carbsRemainingG}g carbs · {formatMl(Math.max(0, gapAnalysis.hydrationRemainingMl))} water
        </AppText>
      </Card>

      {coachingTips.length > 0 ? (
        <Card style={styles.card}>
          <AppText variant="bodyBold">Daily coaching</AppText>
          {coachingTips.map((tip) => (
            <View key={`${tip.action}-${tip.title}`} style={styles.tipRow}>
              <View style={[styles.tipBadge, { backgroundColor: coachingActionColor(tip.action) + '22' }]}>
                <AppText variant="caption" style={{ color: coachingActionColor(tip.action) }}>
                  {coachingActionLabel(tip.action)}
                </AppText>
              </View>
              <AppText variant="footnote" color="textSecondary" style={styles.tipMessage}>
                {tip.message}
              </AppText>
            </View>
          ))}
        </Card>
      ) : null}

      {!compact ? (
        <>
          <Card style={styles.card}>
            <AppText variant="bodyBold">Meal suggestions</AppText>
            {mealSuggestions.map((meal) => (
              <View key={meal.mealType} style={styles.mealRow}>
                <AppText variant="footnote" color="textTertiary">
                  {meal.mealType}
                </AppText>
                <AppText variant="footnote" color="textSecondary">
                  {meal.name} · {meal.calories} kcal · {meal.proteinG}g P
                </AppText>
              </View>
            ))}
          </Card>

          <Card style={styles.card}>
            <AppText variant="bodyBold">Grocery list</AppText>
            {groceryList.slice(0, 12).map((item) => (
              <AppText key={item.name} variant="footnote" color="textSecondary">
                • {item.name}
                {item.quantity ? ` (${item.quantity})` : ''} — {item.category}
              </AppText>
            ))}
          </Card>

          <Card style={styles.card}>
            <AppText variant="bodyBold">Weekly plan</AppText>
            {weeklyPlan.map((day) => (
              <View key={day.date} style={styles.weekRow}>
                <AppText variant="footnote" color="textTertiary">
                  {day.dayLabel}
                </AppText>
                <AppText variant="footnote" color="textSecondary">
                  {day.calories} kcal · {day.isTrainingDay ? 'Training' : 'Rest'}
                  {day.focus ? ` · ${day.focus}` : ''}
                </AppText>
              </View>
            ))}
          </Card>

          <Card style={styles.card}>
            <AppText variant="bodyBold">Why these targets</AppText>
            <AppText variant="footnote" color="textSecondary">
              {report.rationale}
            </AppText>
          </Card>
        </>
      ) : null}
    </View>
  );
}

function MacroChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.chip}>
      <AppText variant="caption" color="textTertiary">
        {label}
      </AppText>
      <AppText variant="footnote" color="textPrimary">
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md, marginBottom: Spacing.xl },
  card: { gap: Spacing.sm },
  macroRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    backgroundColor: LiftFlowColors.surfaceElevated,
    borderRadius: 8,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    minWidth: 64,
  },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginTop: Spacing.xs },
  tipBadge: { borderRadius: 6, paddingHorizontal: Spacing.xs, paddingVertical: 2 },
  tipMessage: { flex: 1 },
  mealRow: { marginTop: Spacing.xs },
  weekRow: { marginTop: Spacing.xs },
});
