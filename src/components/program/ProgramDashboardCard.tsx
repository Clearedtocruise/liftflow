import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { AppText } from '@/components/ui/AppText';
import { Spacing } from '@/constants/theme';
import type { PlannedWorkout, ProgramDashboard } from '@/types';

type ProgramDashboardCardProps = {
  dashboard: ProgramDashboard | null;
  onAdapt?: () => void;
  onStartNextWorkout?: (workout: PlannedWorkout) => void;
  startingWorkout?: boolean;
  adapting?: boolean;
};

export function ProgramDashboardCard({ dashboard, onAdapt, onStartNextWorkout, startingWorkout, adapting }: ProgramDashboardCardProps) {
  if (!dashboard) {
    return (
      <Card style={styles.card}>
        <AppText variant="bodyBold">Training Program</AppText>
        <AppText variant="body" color="textSecondary">
          No active program — create a structured plan instead of one-off workouts.
        </AppText>
        <PrimaryButton label="Create Program" onPress={() => router.push('/(features)/program-create')} />
      </Card>
    );
  }

  const sprintPhase =
    (dashboard.phase?.metadata as { sprintPhase?: string } | undefined)?.sprintPhase ??
    dashboard.phase?.phaseType ??
    '—';

  return (
    <Card style={styles.card} accent>
      <View style={styles.header}>
        <View style={styles.flex}>
          <AppText variant="caption" color="accent">
            Active Program
          </AppText>
          <AppText variant="bodyBold">{dashboard.program.name}</AppText>
        </View>
        <AppText variant="metric" color="accent">
          {dashboard.completionPct}%
        </AppText>
      </View>

      <View style={styles.statsRow}>
        <Stat label="Week" value={String(dashboard.currentWeek)} />
        <Stat label="Phase" value={String(sprintPhase)} />
        <Stat label="Done" value={`${dashboard.totalCompleted}/${dashboard.totalPlanned}`} />
      </View>

      {dashboard.nextWorkout ? (
        <View style={styles.next}>
          <AppText variant="caption" color="textSecondary">
            Next workout
          </AppText>
          <AppText variant="body">{dashboard.nextWorkout.name}</AppText>
          <AppText variant="footnote" color="textTertiary">
            {dashboard.nextWorkout.scheduledDate}
            {dashboard.nextWorkout.metadata?.slotLabel ? ` · ${dashboard.nextWorkout.metadata.slotLabel}` : ''}
          </AppText>
        </View>
      ) : null}

      <View style={styles.actions}>
        {dashboard.nextWorkout && onStartNextWorkout ? (
          <PrimaryButton
            label={startingWorkout ? 'Starting…' : 'Start Next Workout'}
            onPress={() => onStartNextWorkout(dashboard.nextWorkout!)}
            disabled={startingWorkout}
          />
        ) : null}
        <PrimaryButton label="Calendar" onPress={() => router.push('/(features)/program-calendar')} variant="secondary" />
        <PrimaryButton label="Change split" onPress={() => router.push('/(features)/training-split')} variant="secondary" />
        <PrimaryButton label={adapting ? 'Adapting…' : 'Adapt Program'} onPress={() => onAdapt?.()} variant="secondary" disabled={adapting || !onAdapt} />
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
  card: { gap: Spacing.md, marginBottom: Spacing.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  flex: { flex: 1, gap: Spacing.xs },
  statsRow: { flexDirection: 'row', gap: Spacing.xl },
  stat: { gap: Spacing.xs },
  next: { gap: Spacing.xs },
  actions: { gap: Spacing.sm },
});
