import { StyleSheet, View } from 'react-native';

import { MuscleRecoveryHeatMap } from '@/components/recovery/MuscleRecoveryHeatMap';
import { RecoveryTrendChart } from '@/components/recovery/RecoveryTrendChart';
import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { statusColorKey } from '@/lib/recoveryIntelligenceEngine';
import type { RecoveryIntelligenceReport } from '@/types/recoveryIntelligence';

type RecoveryIntelligenceDashboardProps = {
  report: RecoveryIntelligenceReport;
  compact?: boolean;
};

export function RecoveryIntelligenceDashboard({ report, compact = false }: RecoveryIntelligenceDashboardProps) {
  const statusColor = statusColorKey(report.recoveryStatus);

  return (
    <View style={styles.wrap}>
      <Card style={styles.scoreCard} accent={report.recoveryStatus === 'overtrained'}>
        <View style={styles.scoreHeader}>
          <View>
            <AppText variant="caption" color="textSecondary">
              Recovery Score
            </AppText>
            <AppText variant="metric" color={statusColor}>
              {report.recoveryScore}
            </AppText>
          </View>
          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: LiftFlowColors.surfaceHighlight }]}>
              <AppText variant="caption" color={statusColor}>
                {report.recoveryStatusLabel}
              </AppText>
            </View>
            <View style={[styles.badge, { backgroundColor: LiftFlowColors.accentGlow }]}>
              <AppText variant="caption" color="accent">
                {report.trainingRecommendationLabel}
              </AppText>
            </View>
          </View>
        </View>

        <AppText variant="body" color="textSecondary">
          {report.rationale}
        </AppText>

        {!compact ? (
          <View style={styles.factorRow}>
            <Factor label="Subjective" value={report.factors.subjectiveScore} />
            <Factor label="Load" value={report.factors.trainingLoadScore} />
            <Factor label="Muscles" value={report.factors.muscleReadinessScore} />
          </View>
        ) : null}
      </Card>

      {!compact ? (
        <>
          <Card style={styles.section}>
            <AppText variant="bodyBold">Muscle Recovery</AppText>
            <AppText variant="caption" color="textSecondary">
              Per-muscle readiness based on recent volume and time since last trained
            </AppText>
            <MuscleRecoveryHeatMap muscles={report.muscleRecovery} />
            {report.suggestedMuscleGroups.length > 0 ? (
              <AppText variant="footnote" color="textSecondary">
                Suggested focus: {report.suggestedMuscleGroups.join(', ')}
              </AppText>
            ) : null}
            {report.avoidMuscleGroups.length > 0 ? (
              <AppText variant="footnote" color="restTimer">
                Avoid heavy loading: {report.avoidMuscleGroups.join(', ')}
              </AppText>
            ) : null}
          </Card>

          <Card style={styles.section}>
            <RecoveryTrendChart trend={report.trend} />
          </Card>

          <Card style={styles.section}>
            <AppText variant="bodyBold">Training Load Signals</AppText>
            <LoadSignal label="Sessions (3d)" value={String(report.factors.sessionCount3d)} />
            <LoadSignal
              label="Volume (3d)"
              value={Math.round(report.factors.totalVolume3d).toLocaleString()}
            />
            <LoadSignal label="Consecutive days" value={String(report.factors.consecutiveTrainingDays)} />
            <LoadSignal label="Avg duration" value={`${report.factors.avgSessionDurationMin} min`} />
            <LoadSignal label="Workouts (7d)" value={String(report.factors.workoutsLast7d)} />
            {!report.factors.healthKitAvailable ? (
              <AppText variant="caption" color="textTertiary">
                Connect Apple Health in Settings → Health & Strava to enrich recovery with sleep and HRV.
              </AppText>
            ) : (
              <AppText variant="caption" color="success">
                Apple Health data connected — sleep and vitals included in scoring when available.
              </AppText>
            )}
          </Card>
        </>
      ) : null}
    </View>
  );
}

function Factor({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.factor}>
      <AppText variant="caption" color="textTertiary">
        {label}
      </AppText>
      <AppText variant="bodyBold">{value}</AppText>
    </View>
  );
}

function LoadSignal({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.loadRow}>
      <AppText variant="footnote" color="textSecondary">
        {label}
      </AppText>
      <AppText variant="footnote">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.lg },
  scoreCard: { gap: Spacing.md },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  badges: { alignItems: 'flex-end', gap: Spacing.xs },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 999,
  },
  factorRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginTop: Spacing.sm,
  },
  factor: { gap: 2 },
  section: { gap: Spacing.md },
  loadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
});
