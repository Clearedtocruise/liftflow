import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Sparkline } from '@/components/ui/Sparkline';
import { LiftFlowColors, MetricAccents, Radius, Spacing, type MetricAccent } from '@/constants/theme';

type StatTileProps = {
  label: string;
  /** Already formatted for display. Undefined means not recorded, and renders as an em dash. */
  value?: string;
  caption?: string;
  accent: MetricAccent;
  history?: (number | undefined)[];
  chart?: 'line' | 'bars';
  /**
   * 0–100 progress toward a target. Replaces the sparkline, because "how far through today am I"
   * is a position against a goal rather than a trend over days.
   */
  progressPercent?: number;
  /** Shown in place of the caption when there is nothing to show yet. */
  emptyHint?: string;
  onPress?: () => void;
};

export function StatTile({
  label,
  value,
  caption,
  accent,
  history = [],
  chart = 'line',
  progressPercent,
  emptyHint,
  onPress,
}: StatTileProps) {
  const { tint, glow } = MetricAccents[accent];
  const hasValue = value != null;
  // Over-target still fills the bar rather than overflowing it; the caption carries the overage.
  const filled = progressPercent != null ? Math.max(0, Math.min(100, progressPercent)) : null;

  const body = (
    <>
      <AppText variant="label" color="textTertiary">
        {label}
      </AppText>
      <AppText variant="headline" style={hasValue ? { color: tint } : styles.missing}>
        {hasValue ? value : '—'}
      </AppText>
      <AppText variant="caption" color="textTertiary" numberOfLines={1}>
        {hasValue ? (caption ?? ' ') : (emptyHint ?? 'No data yet')}
      </AppText>
      {hasValue && filled != null ? (
        <View style={styles.chart}>
          <View style={[styles.track, { backgroundColor: glow }]}>
            <View style={[styles.fill, { width: `${filled}%`, backgroundColor: tint }]} />
          </View>
        </View>
      ) : /* No reserved space when there is no series: an empty chart slot reads as a failed chart. */
      history.filter((point) => point != null).length > 1 ? (
        <View style={styles.chart}>
          <Sparkline values={history} tint={tint} width={112} height={30} variant={chart} />
        </View>
      ) : null}
    </>
  );

  if (!onPress) return <View style={styles.tile}>{body}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${hasValue ? value : 'no data yet'}`}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 148,
    gap: 2,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    backgroundColor: LiftFlowColors.surface,
  },
  pressed: {
    opacity: 0.85,
  },
  missing: {
    color: LiftFlowColors.textMuted,
  },
  chart: {
    marginTop: Spacing.xs,
    height: 30,
    justifyContent: 'flex-end',
  },
  track: {
    height: 6,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radius.full,
  },
});
