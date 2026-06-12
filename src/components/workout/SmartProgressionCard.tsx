import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { useUnits } from '@/hooks/useUnits';
import type { ExerciseLoggingMode } from '@/lib/exerciseModality';
import { kgToDisplayWeight } from '@/lib/smartProgressionEngine';
import { progressionService } from '@/services/progressionService';
import type { ProgressionSetRecord, SmartProgressionRecommendation } from '@/types/progression';

type SmartProgressionCardProps = {
  userId: string;
  exerciseId: string;
  exerciseName: string;
  sessionId?: string;
  currentSessionSets?: ProgressionSetRecord[];
  recoveryScore?: number;
  recoveryVolumeMultiplier?: number;
  variant?: 'default' | 'inline';
  loggingMode?: ExerciseLoggingMode;
  onApplyTarget?: (recommended: { weightKg: number; reps: number }) => void;
};

export function SmartProgressionCard({
  userId,
  exerciseId,
  exerciseName,
  sessionId,
  currentSessionSets = [],
  recoveryScore,
  recoveryVolumeMultiplier,
  variant = 'default',
  loggingMode = 'weighted',
  onApplyTarget,
}: SmartProgressionCardProps) {
  const units = useUnits();
  const [loading, setLoading] = useState(true);
  const [rec, setRec] = useState<SmartProgressionRecommendation | null>(null);
  const inline = variant === 'inline';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    progressionService
      .getSmartProgression(userId, exerciseId, {
        exerciseName,
        sessionId,
        currentSessionSets,
        recoveryScore,
        recoveryVolumeMultiplier,
      })
      .then((result) => {
        if (cancelled) return;
        if (result.success) setRec(result.data);
        else setRec(null);
      })
      .catch(() => {
        if (!cancelled) setRec(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, exerciseId, exerciseName, sessionId, currentSessionSets, recoveryScore, recoveryVolumeMultiplier]);

  if (loading) {
    if (inline) {
      return (
        <View style={styles.inlineLoading}>
          <ActivityIndicator color={LiftFlowColors.accent} size="small" />
          <AppText variant="caption" color="textSecondary">
            Loading coach target…
          </AppText>
        </View>
      );
    }
    return (
      <Card style={styles.card}>
        <ActivityIndicator color={LiftFlowColors.accent} />
      </Card>
    );
  }

  if (!rec) return null;

  const weightDisplay =
    rec.recommended.weightKg > 0
      ? kgToDisplayWeight(rec.recommended.weightKg, units.preferredWeightUnit)
      : null;

  const targetLabel =
    loggingMode === 'bodyweight'
      ? `${rec.recommended.reps} reps`
      : weightDisplay != null
        ? `${weightDisplay} ${units.weightLabel} × ${rec.recommended.reps}`
        : `${rec.recommended.reps} reps`;

  const content = (
    <>
      <AppText variant="label" color="accent">
        Coach target · Set {(currentSessionSets.length ?? 0) + 1}
      </AppText>
      <AppText variant="bodyBold" color={inline ? 'textPrimary' : undefined}>
        {targetLabel}
      </AppText>
      <AppText variant="footnote" color="textSecondary">
        {rec.reason}
      </AppText>
      <View style={styles.meta}>
        <AppText variant="caption" color="textTertiary">
          {rec.adjustmentType.replace(/_/g, ' ')} · {Math.round(rec.confidence * 100)}% confidence
        </AppText>
      </View>
      {onApplyTarget ? (
        <Pressable
          style={({ pressed }) => [styles.applyButton, pressed && styles.applyButtonPressed]}
          onPress={() => onApplyTarget(rec.recommended)}>
          <AppText variant="caption" color="accent">
            Use target
          </AppText>
        </Pressable>
      ) : null}
    </>
  );

  if (inline) {
    return <View style={styles.inline}>{content}</View>;
  }

  return (
    <Card style={styles.card}>
      <AppText variant="subhead" color="textSecondary">
        Smart progression
      </AppText>
      <AppText variant="bodyBold">{exerciseName}</AppText>
      {content}
    </Card>
  );
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
  inlineLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  meta: { marginTop: Spacing.xs },
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
