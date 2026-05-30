import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import type { WorkoutHistoryItem } from '@/types/workout';

type HistoryCardProps = {
  item: WorkoutHistoryItem;
  onPress?: () => void;
  onLongPress?: () => void;
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function HistoryCard({ item, onPress, onLongPress }: HistoryCardProps) {
  return (
    <Card onPress={onPress} onLongPress={onLongPress} style={styles.card}>
      <View style={styles.header}>
        <View>
          <AppText variant="bodyBold">{item.name}</AppText>
          <AppText variant="footnote" color="textSecondary">
            {formatDate(item.date)} · {item.durationMinutes} min
          </AppText>
        </View>
        {item.prCount ? (
          <View style={styles.prBadge}>
            <AppText variant="caption" color="accent">
              {item.prCount} PR{item.prCount > 1 ? 's' : ''}
            </AppText>
          </View>
        ) : null}
      </View>

      <View style={styles.statsRow}>
        <Stat label="Exercises" value={String(item.exerciseCount)} />
        <Stat label="Sets" value={String(item.totalSets)} />
        <Stat label="Volume" value={`${(item.totalVolume / 1000).toFixed(1)}k`} />
      </View>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <AppText variant="caption" color="textTertiary">
        {label}
      </AppText>
      <AppText variant="callout">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  prBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 999,
    backgroundColor: LiftFlowColors.accentGlow,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.xl,
  },
  stat: {
    gap: Spacing.xs,
  },
});
