import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import type { ExerciseLoggingMode } from '@/lib/exerciseModality';
import { coachAdjustmentColor, coachAdjustmentLabel } from '@/lib/coachAdjustmentLabels';
import { kgToDisplayWeight } from '@/lib/smartProgressionEngine';
import { exerciseCoachService } from '@/services/exerciseCoachService';
import { useUnits } from '@/hooks/useUnits';
import type { ExerciseCoachPrescription, ExercisePrescriptionPlanInput } from '@/types/exerciseCoach';
import type { ProgressionSetRecord } from '@/types/progression';

type ExerciseCoachCardProps = {
  userId: string;
  exerciseId: string;
  plan?: Omit<ExercisePrescriptionPlanInput, 'exerciseId'>;
  sessionId?: string;
  currentSessionSets?: ProgressionSetRecord[];
  loggingMode?: ExerciseLoggingMode;
  variant?: 'default' | 'inline' | 'compact';
  setNumber?: number;
  onApplyTarget?: (recommended: { weightKg: number; reps: number }) => void;
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
        currentSessionSets,
      })
      .then((result) => {
        if (cancelled) return;
        setPrescription(result.success ? result.data : null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, exerciseId, plan, sessionId, currentSessionSets]);

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
  const weightDisplay =
    targets.weightKg > 0 ? kgToDisplayWeight(targets.weightKg, units.preferredWeightUnit) : null;
  const targetLine =
    loggingMode === 'bodyweight'
      ? `${targets.sets} sets × ${targets.reps} reps`
      : weightDisplay != null
        ? `${targets.sets} sets × ${weightDisplay} ${units.weightLabel} × ${targets.reps}`
        : `${targets.sets} sets × ${targets.reps} reps`;

  const adjColor = coachAdjustmentColor(prescription.adjustmentLabel);
  const content = (
    <>
      <View style={styles.headerRow}>
        <AppText variant="label" color="accent">
          Coach prescription{setNumber ? ` · Set ${setNumber}` : ''}
        </AppText>
        <AppText variant="caption" color={adjColor}>
          {coachAdjustmentLabel(prescription.adjustmentLabel)}
        </AppText>
      </View>

      <AppText variant="bodyBold">{targetLine}</AppText>
      <AppText variant="footnote" color="textSecondary">
        Rest {formatRest(targets.restSeconds)} · Recovery {prescription.contextUsed.recoveryScore} · Readiness{' '}
        {prescription.contextUsed.readinessScore}
      </AppText>
      <AppText variant="footnote" color="textSecondary">
        {prescription.reason}
      </AppText>

      {expanded ? (
        <>
          <AppText variant="caption" color="textTertiary">
            Why this exercise
          </AppText>
          {prescription.whySelected.map((line) => (
            <AppText key={line} variant="footnote" color="textSecondary">
              • {line}
            </AppText>
          ))}
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

      {onApplyTarget && loggingMode !== 'timed' ? (
        <Pressable
          style={({ pressed }) => [styles.applyButton, pressed && styles.applyButtonPressed]}
          onPress={() => onApplyTarget({ weightKg: targets.weightKg, reps: targets.reps })}>
          <AppText variant="caption" color="accent">
            Use coach target
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
          {coachAdjustmentLabel(prescription.adjustmentLabel)}
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
