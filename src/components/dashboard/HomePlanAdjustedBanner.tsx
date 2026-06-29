import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { usePlanAdjustment } from '@/contexts/PlanAdjustmentContext';

export function HomePlanAdjustedBanner() {
  const { adjustment, dismiss } = usePlanAdjustment();
  const [expanded, setExpanded] = useState(false);

  if (!adjustment) return null;

  const headline =
    adjustment.headline.toLowerCase() === 'plan adjusted'
      ? 'Plan adjusted'
      : adjustment.headline;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <AppText variant="label" color="accent">
          {headline}
        </AppText>
        <Pressable onPress={dismiss} hitSlop={8} accessibilityLabel="Dismiss plan update">
          <AppText variant="caption" color="textTertiary">
            ✕
          </AppText>
        </Pressable>
      </View>
      <View style={styles.messages}>
        {adjustment.messages.map((line) => (
          <View key={line} style={styles.messageRow}>
            <AppText variant="caption" color="textTertiary" style={styles.bullet}>
              •
            </AppText>
            <AppText variant="footnote" color="textSecondary" style={styles.messageText}>
              {line}
            </AppText>
          </View>
        ))}
      </View>
      <Pressable onPress={() => setExpanded((v) => !v)} accessibilityRole="button">
        <AppText variant="caption" color="primary">
          {expanded ? 'Hide why' : 'Why?'}
        </AppText>
      </Pressable>
      {expanded ? (
        <AppText variant="caption" color="textTertiary">
          {adjustment.rationale}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: LiftFlowColors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messages: {
    gap: Spacing.xs,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  bullet: {
    lineHeight: 18,
    width: 12,
  },
  messageText: {
    flex: 1,
  },
});
