import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { useUnits } from '@/hooks/useUnits';
import { formatCoachTargetLine } from '@/lib/activeWorkoutMetrics';
import { coachAdjustmentColor, coachAdjustmentLabel } from '@/lib/coachAdjustmentLabels';
import type { ExerciseLoggingMode } from '@/lib/exerciseModality';
import { defaultTimedDurationSeconds } from '@/lib/exerciseModality';
import { kgToDisplayWeight } from '@/lib/smartProgressionEngine';
import { exerciseCoachService } from '@/services/exerciseCoachService';
import type { ExerciseCoachPrescription, ExercisePrescriptionPlanInput } from '@/types/exerciseCoach';

type ExerciseCoachCardProps = {
  userId: string;
  exerciseId: string;
  plan?: Omit<ExercisePrescriptionPlanInput, 'exerciseId'>;
  sessionId?: string;
  currentSessionSets?: ExercisePrescriptionPlanInput['currentSessionSets'];
  loggingMode?: ExerciseLoggingMode;
  variant?: 'default' | 'inline' | 'compact';
  setNumber?: number;
  titleLabel?: string;
  showPerformanceSummary?: boolean;
  onPrescription?: (prescription: ExerciseCoachPrescription | null) => void;
  onApplyTarget?: (recommended: { weightKg: number; reps: number; durationSeconds?: number }) => void;
};

function formatRest(seconds: number): string {
  if (seconds >= 60) return `${Math.round(seconds / 60)} min`;
  return `${seconds}s`;
}

export function ExerciseCoachCard({
  userId,
  exerciseId,
  plan,
  sessionId,
  currentSessionSets = [],
  loggingMode = 'weighted',
  variant = 'default',
  setNumber,
  titleLabel = 'Coach prescription',
  showPerformanceSummary = true,
  onPrescription,
  onApplyTarget,
}: ExerciseCoachCardProps) {
  const units = useUnits();
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(variant !== 'compact');
  const [prescription, setPrescription] = useState<ExerciseCoachPrescription | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    exerciseCoachService
      .getPrescription(userId, exerciseId, {
        ...plan,
        sessionId,
        loggingMode,
        currentSessionSets,
      })
      .then((result) => {
        if (cancelled) return;
        const next = result.success ? result.data : null;
        setPrescription(next);
        onPrescription?.(next);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, exerciseId, plan, sessionId, loggingMode, currentSessionSets, onPrescription]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={LiftFlowColors.accent} size="small" />
        <AppText variant="caption" color="textSecondary">
          Coach analyzing…
        </AppText>
      </View>
    );
  }

  if (!prescription) return null;

  const { targets } = prescription;
  const displayLabel =
    loggingMode === 'timed' && prescription.adjustmentLabel === 'deload'
      ? 'maintain'
      : prescription.adjustmentLabel;
  const targetLine = formatCoachTargetLine(
    targets,
    loggingMode,
    (kg) => kgToDisplayWeight(kg, units.preferredWeightUnit),
    units.weightLabel,
    plan?.plannedReps,
  );

  const adjColor = coachAdjustmentColor(displayLabel);
  const content = (
    <>
      {showPerformanceSummary ? (
        <>
          <View style={styles.headerRow}>
            <AppText variant="label" color="accent">
              {titleLabel}{setNumber ? ` · Set ${setNumber}` : ''}
            </AppText>
            <AppText variant="caption" color={adjColor}>
              {coachAdjustmentLabel(displayLabel)}
            </AppText>
          </View>

          <AppText variant="bodyBold">{targetLine}</AppText>
        </>
      ) : (
        <View style={styles.headerRow}>
          <AppText variant="caption" color={adjColor}>
            {coachAdjustmentLabel(displayLabel)}
          </AppText>
        </View>
      )}
      <AppText variant="footnote" color="textSecondary">
        Rest {formatRest(targets.restSeconds)} · Recovery {prescription.contextUsed.recoveryScore}
        {prescription.contextUsed.trainingLabel
          ? ` · ${prescription.contextUsed.trainingLabel}`
          : null}
      </AppText>
      <AppText variant="footnote" color="textSecondary">
        {prescription.reason}
      </AppText>

      {expanded ? (
        <>
          {prescription.whySelected?.length ? (
            <>
              <AppText variant="caption" color="textTertiary">
                Why this exercise
              </AppText>
              {prescription.whySelected.map((line) => (
                <AppText key={line} variant="footnote" color="textSecondary">
                  • {line}
                </AppText>
              ))}
            </>
          ) : null}
          <AppText variant="caption" color="textTertiary">
            Reasoning
          </AppText>
          <AppText variant="footnote" color="textSecondary">
            {prescription.detailedReason}
          </AppText>
          {prescription.contextUsed.programPhase ? (
            <AppText variant="caption" color="textTertiary">
              Phase: {prescription.contextUsed.programPhase.replace(/_/g, ' ')} · Nutrition adherence{' '}
              {prescription.contextUsed.nutritionAdherencePct ?? '—'}%
            </AppText>
          ) : null}
        </>
      ) : (
        <Pressable onPress={() => setExpanded(true)}>
          <AppText variant="caption" color="accent">
            Show coach reasoning
          </AppText>
        </Pressable>
      )}

      {onApplyTarget ? (
        <Pressable
          style={({ pressed }) => [styles.applyButton, pressed && styles.applyButtonPressed]}
          onPress={() =>
            onApplyTarget({
              weightKg: loggingMode === 'timed' ? 0 : targets.weightKg,
              reps: loggingMode === 'timed' ? 1 : targets.reps,
              durationSeconds:
                loggingMode === 'timed'
                  ? targets.durationSeconds ?? defaultTimedDurationSeconds(targets.repRange || plan?.plannedReps)
                  : undefined,
            })
          }>
          <AppText variant="caption" color="accent">
            Use target
          </AppText>
        </Pressable>
      ) : null}
    </>
  );

  if (variant === 'inline') {
    return <View style={styles.inline}>{content}</View>;
  }

  if (variant === 'compact') {
    return (
      <View style={styles.compact}>
        <AppText variant="caption" color={adjColor}>
          {coachAdjustmentLabel(displayLabel)}
        </AppText>
        <AppText variant="footnote" color="textSecondary">
          {targetLine} · {prescription.reason}
        </AppText>
      </View>
    );
  }

  return <Card style={styles.card}>{content}</Card>;
}

const styles = StyleSheet.create({
  card: { gap: Spacing.xs, marginBottom: Spacing.md },
  inline: {
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.backgroundSecondary,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  compact: { gap: 2, marginTop: Spacing.xs },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  applyButton: {
    alignSelf: 'flex-start',
    marginTop: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: LiftFlowColors.accent,
  },
  applyButtonPressed: {
    backgroundColor: LiftFlowColors.accentGlow,
  },
});
