import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { usePlanAdjustment } from '@/contexts/PlanAdjustmentContext';

export function HomePlanAdjustedBanner() {
  const { adjustment, dismiss } = usePlanAdjustment();
  const [expanded, setExpanded] = useState(false);

  if (!adjustment) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <AppText variant="label" color="accent">
          {adjustment.headline}
        </AppText>
        <Pressable onPress={dismiss} hitSlop={8}>
          <AppText variant="caption" color="textTertiary">
            ✕
          </AppText>
        </Pressable>
      </View>
      {adjustment.messages.map((line) => (
        <AppText key={line} variant="footnote" color="textSecondary">
          {line}
        </AppText>
      ))}
      <Pressable onPress={() => setExpanded((v) => !v)}>
        <AppText variant="caption" color="primary">
          {expanded ? 'Hide explanation' : 'Why?'}
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
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
