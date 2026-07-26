import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Sparkline } from '@/components/ui/Sparkline';
import { LiftFlowColors, MetricAccents, Radius, Spacing } from '@/constants/theme';

export type CoachInsight = {
  /** One sentence about something the lifter actually did. */
  message: string;
  /** e.g. "+25 lbs" — omitted when there is no single number worth pulling out. */
  badge?: string;
  /** The series behind the claim, so the number is shown rather than only asserted. */
  history?: (number | undefined)[];
};

type CoachInsightCardProps = {
  insight: CoachInsight;
  onPress: () => void;
};

export function CoachInsightCard({ insight, onPress }: CoachInsightCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Coach insight: ${insight.message}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.avatar}>
        <AppText variant="headline">🤖</AppText>
      </View>

      <View style={styles.body}>
        <View style={styles.topRow}>
          <AppText variant="label" style={styles.kicker}>
            AI COACH
          </AppText>
          {insight.badge ? (
            <View style={styles.badge}>
              <AppText variant="caption" style={styles.badgeText}>
                {insight.badge}
              </AppText>
            </View>
          ) : null}
        </View>

        <AppText variant="callout">{insight.message}</AppText>

        {insight.history && insight.history.length > 1 ? (
          <View style={styles.chart}>
            <Sparkline values={insight.history} tint={MetricAccents.coach.tint} width={168} height={34} />
          </View>
        ) : null}

        <AppText variant="footnote" color="accent">
          View Insight ›
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    backgroundColor: LiftFlowColors.surface,
  },
  pressed: {
    opacity: 0.88,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MetricAccents.coach.glow,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  body: {
    flex: 1,
    gap: Spacing.xs,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  kicker: {
    color: MetricAccents.coach.tint,
  },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: MetricAccents.coach.glow,
  },
  badgeText: {
    color: MetricAccents.coach.tint,
  },
  chart: {
    marginTop: Spacing.xs,
  },
});
