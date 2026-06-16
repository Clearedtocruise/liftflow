import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';

type WeeklyReviewCardProps = {
  weekLabel: string;
  onViewSummary: () => void;
  onReviewNextWeek: () => void;
  onAdjust: () => void;
  onAccept: () => void;
  accepting?: boolean;
};

export function WeeklyReviewCard({
  weekLabel,
  onViewSummary,
  onReviewNextWeek,
  onAdjust,
  onAccept,
  accepting,
}: WeeklyReviewCardProps) {
  return (
    <Card style={styles.card} glow>
      <AppText variant="label" color="accent">
        Weekly Review Ready
      </AppText>
      <AppText variant="bodyBold">{weekLabel}</AppText>
      <AppText variant="footnote" color="textSecondary">
        Your training and nutrition week is ready to close. Review before next week activates.
      </AppText>
      <View style={styles.actions}>
        <PrimaryButton label="View Weekly Summary" onPress={onViewSummary} />
        <PrimaryButton label="Review Next Week Plan" onPress={onReviewNextWeek} variant="secondary" />
        <PrimaryButton label="Adjust Next Week" onPress={onAdjust} variant="secondary" />
        <PrimaryButton label="Accept Plan" onPress={onAccept} loading={accepting} variant="ghost" />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.sm, borderColor: LiftFlowColors.accent },
  actions: { gap: Spacing.sm, marginTop: Spacing.sm },
});
