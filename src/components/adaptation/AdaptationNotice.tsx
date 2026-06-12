import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { Spacing } from '@/constants/theme';
import type { PreferenceAdaptationReport } from '@/types/adaptation';

type AdaptationNoticeProps = {
  report: PreferenceAdaptationReport;
};

export function AdaptationNotice({ report }: AdaptationNoticeProps) {
  if (!report.adapted && report.changes.length === 0) {
    return null;
  }

  return (
    <Card style={styles.card} glow={report.adapted}>
      <AppText variant="label" color="accent">
        {report.notificationTitle}
      </AppText>
      <AppText variant="footnote" color="textSecondary">
        {report.notificationBody}
      </AppText>

      {report.workoutSwaps.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="caption" color="textTertiary">
            Workout updates
          </AppText>
          {report.workoutSwaps.slice(0, 5).map((swap) => (
            <AppText key={`${swap.workoutDate}-${swap.from}`} variant="footnote" color="textSecondary">
              {swap.workoutDate}: {swap.from} → {swap.to}
            </AppText>
          ))}
        </View>
      ) : null}

      {report.mealSwaps.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="caption" color="textTertiary">
            Meal updates
          </AppText>
          {report.mealSwaps.slice(0, 5).map((swap) => (
            <AppText key={`${swap.date}-${swap.mealType}-${swap.from}`} variant="footnote" color="textSecondary">
              {swap.date} {swap.mealType}: {swap.from} → {swap.to}
            </AppText>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.sm, marginBottom: Spacing.lg },
  section: { gap: 2, marginTop: Spacing.xs },
});
