import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { useUnits } from '@/hooks/useUnits';
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
};

export function SmartProgressionCard({
  userId,
  exerciseId,
  exerciseName,
  sessionId,
  currentSessionSets = [],
  recoveryScore,
  recoveryVolumeMultiplier,
}: SmartProgressionCardProps) {
  const units = useUnits();
  const [loading, setLoading] = useState(true);
  const [rec, setRec] = useState<SmartProgressionRecommendation | null>(null);

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
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, exerciseId, exerciseName, sessionId, currentSessionSets, recoveryScore, recoveryVolumeMultiplier]);

  if (loading) {
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

  return (
    <Card style={styles.card}>
      <AppText variant="subhead" color="textSecondary">
        Smart progression
      </AppText>
      <AppText variant="bodyBold">{exerciseName}</AppText>
      {weightDisplay != null ? (
        <AppText variant="title" color="accent">
          {weightDisplay} {units.weightLabel} × {rec.recommended.reps}
        </AppText>
      ) : (
        <AppText variant="body" color="textSecondary">
          Choose a starting weight
        </AppText>
      )}
      <AppText variant="footnote" color="textSecondary">
        {rec.reason}
      </AppText>
      <View style={styles.meta}>
        <AppText variant="caption" color="textTertiary">
          {rec.adjustmentType.replace(/_/g, ' ')} · {Math.round(rec.confidence * 100)}% confidence
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.xs, marginBottom: Spacing.md },
  meta: { marginTop: Spacing.xs },
});
