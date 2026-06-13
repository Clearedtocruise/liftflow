import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import {
    formatDisplayDate,
    formatMassFromKg,
    formatPaceFromKgPerWeek,
} from '@/lib/transformation/transformationStory';
import type { TransformationStory } from '@/types/transformation';

type CoachProjectionCardProps = {
  story: TransformationStory;
  formatWeight: (kg: number) => string;
  weightUnit: 'kg' | 'lb';
};

function statusColor(status: TransformationStory['scheduleStatus']): 'success' | 'accent' | 'warning' | 'textSecondary' {
  switch (status) {
    case 'ahead':
    case 'at_goal':
      return 'success';
    case 'behind':
      return 'warning';
    case 'on_track':
      return 'accent';
    default:
      return 'textSecondary';
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <AppText variant="footnote" color="textSecondary">
        {label}
      </AppText>
      <AppText variant="bodyBold">{value}</AppText>
    </View>
  );
}

export function CoachProjectionCard({ story, formatWeight, weightUnit }: CoachProjectionCardProps) {
  const pace = formatPaceFromKgPerWeek(story.currentPaceKgPerWeek, weightUnit);

  return (
    <Card style={styles.card}>
      <AppText variant="label" color="accent">
        Coach projection
      </AppText>

      <View style={styles.columns}>
        <View style={styles.column}>
          <AppText variant="caption" color="textTertiary">
            Current
          </AppText>
          <AppText variant="headline">{formatWeight(story.currentWeightKg)}</AppText>
          <AppText variant="footnote" color="textSecondary">
            {story.currentBodyFatPct}% body fat
          </AppText>
        </View>
        <AppText variant="title" color="textTertiary">
          →
        </AppText>
        <View style={styles.column}>
          <AppText variant="caption" color="textTertiary">
            Goal
          </AppText>
          <AppText variant="headline">{formatWeight(story.goalWeightKg)}</AppText>
          <AppText variant="footnote" color="textSecondary">
            {story.goalBodyFatPct}% body fat
          </AppText>
        </View>
      </View>

      {story.estimatedCompletionDate ? (
        <Row label="Projected completion" value={formatDisplayDate(story.estimatedCompletionDate)} />
      ) : null}
      <Row
        label="Required fat loss"
        value={formatMassFromKg(story.requiredFatLossKg, formatWeight)}
      />
      {pace ? <Row label="Current pace" value={pace} /> : null}
      <View style={styles.statusRow}>
        <AppText variant="footnote" color="textSecondary">
          Status
        </AppText>
        <View style={styles.statusBadge}>
          <AppText variant="caption" color={statusColor(story.scheduleStatus)}>
            {story.scheduleLabel}
          </AppText>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.md },
  columns: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  column: { flex: 1, gap: Spacing.xs },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: LiftFlowColors.surfaceHighlight,
  },
});
