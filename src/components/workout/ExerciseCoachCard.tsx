import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { useSubscription } from '@/hooks/useSubscription';
import { useUnits } from '@/hooks/useUnits';
import { formatCoachTargetLine } from '@/lib/activeWorkoutMetrics';
import { coachAdjustmentColor, coachAdjustmentLabel } from '@/lib/coachAdjustmentLabels';
import { canRetryCoach, classifyCoachFailure, type CoachFailureKind } from '@/lib/coachFailure';
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

function planFallbackLine(
  plan: Omit<ExercisePrescriptionPlanInput, 'exerciseId'> | undefined,
  loggingMode: ExerciseLoggingMode,
  formatWeight: (kg: number) => number,
  weightLabel: string,
): string {
  if (loggingMode === 'timed') {
    const seconds = defaultTimedDurationSeconds(plan?.plannedReps);
    return `${seconds}s hold`;
  }
  if (loggingMode === 'bodyweight') {
    return plan?.plannedReps ? `${plan.plannedReps} reps` : 'Bodyweight reps';
  }
  const reps = plan?.plannedReps ?? '8–12';
  return `${reps} reps · use plan weight`;
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
  const { isPremium, isBetaTester } = useSubscription();
  const coachUnlocked = isPremium || isBetaTester;
  const [initialLoading, setInitialLoading] = useState(coachUnlocked);
  // A paywall refusal and an outage need different copy: only one of them is worth retrying.
  const [fetchError, setFetchError] = useState<CoachFailureKind>('none');
  const [expanded, setExpanded] = useState(variant === 'default');
  const [minimized, setMinimized] = useState(false);
  const [prescription, setPrescription] = useState<ExerciseCoachPrescription | null>(null);
  const prescriptionRef = useRef<ExerciseCoachPrescription | null>(null);
  prescriptionRef.current = prescription;

  const fetchPrescription = useCallback(
    async (options?: { showSpinner?: boolean }) => {
      if (!coachUnlocked) {
        setPrescription(null);
        onPrescription?.(null);
        setFetchError('none');
        setInitialLoading(false);
        return;
      }

      const showSpinner = options?.showSpinner ?? prescriptionRef.current == null;
      if (showSpinner) setInitialLoading(true);
      setFetchError('none');

      const result = await exerciseCoachService.getPrescription(userId, exerciseId, {
        ...plan,
        sessionId,
        loggingMode,
        currentSessionSets,
      });

      if (result.success) {
        setPrescription(result.data);
        onPrescription?.(result.data);
      } else {
        // Keep the last good prescription on a soft refetch failure so a blip mid-set does not
        // wipe coach targets and leave "Coach unavailable" over a working session.
        setFetchError(classifyCoachFailure(result));
        if (prescriptionRef.current == null) {
          setPrescription(null);
          onPrescription?.(null);
        }
      }
      setInitialLoading(false);
    },
    [coachUnlocked, userId, exerciseId, plan, sessionId, loggingMode, currentSessionSets, onPrescription],
  );

  useEffect(() => {
    void fetchPrescription({ showSpinner: true });
    setMinimized(false);
    setExpanded(variant === 'default');
  }, [userId, exerciseId, sessionId, loggingMode, plan?.plannedReps, plan?.plannedSets, plan?.plannedRestSeconds, coachUnlocked, variant]);

  useEffect(() => {
    if (!coachUnlocked || prescriptionRef.current == null) return;
    const timer = setTimeout(() => {
      void fetchPrescription({ showSpinner: false });
    }, 800);
    return () => clearTimeout(timer);
  }, [currentSessionSets, fetchPrescription, coachUnlocked]);

  if (!coachUnlocked) {
    const fallbackLine = planFallbackLine(
      plan,
      loggingMode,
      (kg) => kgToDisplayWeight(kg, units.preferredWeightUnit),
      units.weightLabel,
    );
    const locked = (
      <>
        <AppText variant="label" color="accent">
          {titleLabel}{setNumber ? ` · Set ${setNumber}` : ''}
        </AppText>
        <AppText variant="footnote" color="textSecondary">
          Pro unlocks live coach targets — using your plan for now.
        </AppText>
        <AppText variant="bodyBold">{fallbackLine}</AppText>
      </>
    );
    if (variant === 'inline') return <View style={styles.inline}>{locked}</View>;
    if (variant === 'compact') {
      return (
        <View style={styles.compact}>
          <AppText variant="footnote" color="textSecondary">
            Plan target · {fallbackLine}
          </AppText>
        </View>
      );
    }
    return <Card style={styles.card}>{locked}</Card>;
  }

  if (initialLoading && !prescription) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={LiftFlowColors.accent} size="small" />
        <AppText variant="caption" color="textSecondary">
          Coach analyzing…
        </AppText>
      </View>
    );
  }

  if (!prescription) {
    const fallbackLine = planFallbackLine(
      plan,
      loggingMode,
      (kg) => kgToDisplayWeight(kg, units.preferredWeightUnit),
      units.weightLabel,
    );

    const fallback = (
      <>
        <AppText variant="label" color="accent">
          {titleLabel}{setNumber ? ` · Set ${setNumber}` : ''}
        </AppText>
        <AppText variant="footnote" color="textSecondary">
          {fetchError === 'entitlement'
            ? 'Live coach needs Pro — using your plan targets.'
            : fetchError === 'transient'
              ? "Coach didn't respond — using plan targets."
              : 'Using plan targets while coach syncs.'}
        </AppText>
        <AppText variant="bodyBold">{fallbackLine}</AppText>
        {/* Retrying a paywall just fails again, so only a transient failure offers it. */}
        {canRetryCoach(fetchError) ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry coach"
            hitSlop={8}
            onPress={() => void fetchPrescription({ showSpinner: true })}>
            <AppText variant="caption" color="accent">
              Retry coach
            </AppText>
          </Pressable>
        ) : null}
      </>
    );

    if (variant === 'inline') return <View style={styles.inline}>{fallback}</View>;
    if (variant === 'compact') {
      return (
        <View style={styles.compact}>
          <AppText variant="footnote" color="textSecondary">
            Plan target · {fallbackLine}
          </AppText>
        </View>
      );
    }
    return <Card style={styles.card}>{fallback}</Card>;
  }

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

  if (minimized) {
    const minimizedRow = (
      <Pressable
        onPress={() => setMinimized(false)}
        style={styles.minimizedRow}
        accessibilityRole="button"
        accessibilityLabel="Show coach prescription">
        <AppText variant="caption" color={adjColor}>
          {coachAdjustmentLabel(displayLabel)}
        </AppText>
        <AppText variant="footnote" color="textSecondary" numberOfLines={1} style={styles.minimizedTarget}>
          {targetLine} · applied
        </AppText>
        <AppText variant="caption" color="accent">
          Show
        </AppText>
      </Pressable>
    );
    if (variant === 'inline') return <View style={styles.inlineMinimized}>{minimizedRow}</View>;
    if (variant === 'compact') return <View style={styles.compact}>{minimizedRow}</View>;
    return <Card style={styles.card}>{minimizedRow}</Card>;
  }

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
      {prescription.adjustmentLabel === 'increase_sets' ? (
        <AppText variant="footnote" color="success">
          Coach is adding a set — {prescription.targets.sets} sets total today.
        </AppText>
      ) : null}
      <AppText variant="footnote" color="textSecondary">
        {prescription.reason}
      </AppText>
      {/* A refetch failed but the last good prescription is still on screen — say so rather than
          silently showing stale targets. */}
      {canRetryCoach(fetchError) ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry coach"
          hitSlop={8}
          onPress={() => void fetchPrescription({ showSpinner: true })}>
          <AppText variant="caption" color="accent">
            Showing last update · Retry coach
          </AppText>
        </Pressable>
      ) : null}

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
          <Pressable onPress={() => setExpanded(false)}>
            <AppText variant="caption" color="accent">
              Hide coach reasoning
            </AppText>
          </Pressable>
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
          onPress={() => {
            onApplyTarget({
              weightKg: loggingMode === 'timed' ? 0 : targets.weightKg,
              reps: loggingMode === 'timed' ? 1 : targets.reps,
              durationSeconds:
                loggingMode === 'timed'
                  ? targets.durationSeconds ?? defaultTimedDurationSeconds(targets.repRange || plan?.plannedReps)
                  : undefined,
            });
            setExpanded(false);
            setMinimized(true);
          }}>
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
  inlineMinimized: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.backgroundSecondary,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  minimizedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  minimizedTarget: {
    flex: 1,
  },
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
