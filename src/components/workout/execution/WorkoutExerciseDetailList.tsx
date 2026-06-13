import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { coachAdjustmentLabel } from '@/lib/coachAdjustmentLabels';
import { formatExerciseStationLabel } from '@/lib/supersetFlow';
import { exerciseCoachService } from '@/services/exerciseCoachService';
import type { ExerciseCoachPrescription } from '@/types/exerciseCoach';
import type { EditableWorkoutExercise } from '@/types/workoutExecution';

type WorkoutExerciseDetailListProps = {
  exercises: EditableWorkoutExercise[];
  userId?: string;
  onReplaceExercise?: (index: number, exercise: EditableWorkoutExercise) => void;
};

function formatRest(seconds?: number): string {
  if (!seconds) return '90 sec';
  if (seconds >= 60) return `${Math.round(seconds / 60)} min`;
  return `${seconds} sec`;
}

export function WorkoutExerciseDetailList({
  exercises,
  userId,
  onReplaceExercise,
}: WorkoutExerciseDetailListProps) {
  const [loading, setLoading] = useState(false);
  const [prescriptions, setPrescriptions] = useState<ExerciseCoachPrescription[]>([]);

  const coachInputs = useMemo(
    () =>
      exercises
        .filter((exercise) => exercise.exerciseId)
        .map((exercise) => ({
          exerciseId: exercise.exerciseId!,
          exerciseName: exercise.name,
          plannedSets: exercise.sets,
          plannedReps: exercise.repRange,
          plannedRestSeconds: exercise.restSeconds,
        })),
    [exercises],
  );

  useEffect(() => {
    if (!userId || coachInputs.length === 0) {
      setPrescriptions([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    exerciseCoachService
      .getWorkoutPrescriptions(userId, coachInputs)
      .then((result) => {
        if (cancelled) return;
        setPrescriptions(result.success ? result.data : []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, coachInputs]);

  const prescriptionByExerciseId = useMemo(
    () => new Map(prescriptions.map((item) => [item.exerciseId, item])),
    [prescriptions],
  );

  return (
    <Card style={styles.card}>
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={LiftFlowColors.accent} size="small" />
          <AppText variant="caption" color="textSecondary">
            Loading coach prescriptions…
          </AppText>
        </View>
      ) : null}

      {exercises.map((exercise, index) => {
        const prescription = exercise.exerciseId ? prescriptionByExerciseId.get(exercise.exerciseId) : undefined;
        const stationLabel = formatExerciseStationLabel(exercise, index, exercises);
        return (
          <View key={exercise.id} style={[styles.row, index < exercises.length - 1 && styles.rowBorder]}>
            <AppText variant="caption" color="textTertiary" style={styles.index}>
              {stationLabel ?? String(index + 1)}
            </AppText>
            <View style={styles.content}>
              <AppText variant="bodyBold">
                {stationLabel ? `${stationLabel} · ${exercise.name}` : exercise.name}
              </AppText>
              <AppText variant="footnote" color="textSecondary">
                {prescription
                  ? `${prescription.targets.sets} sets · ${prescription.targets.repRange} reps · Rest ${formatRest(prescription.targets.restSeconds)}`
                  : `${exercise.sets} sets · ${exercise.repRange ?? '8-10'} reps · Rest ${formatRest(exercise.restSeconds ?? 90)}`}
              </AppText>
              {prescription ? (
                <>
                  <AppText variant="caption" color="accent">
                    {coachAdjustmentLabel(prescription.adjustmentLabel)} · {prescription.reason}
                  </AppText>
                  <AppText variant="caption" color="textTertiary">
                    {prescription.detailedReason}
                  </AppText>
                </>
              ) : null}
              {onReplaceExercise ? (
                <Pressable onPress={() => onReplaceExercise(index, exercise)} hitSlop={8}>
                  <AppText variant="footnote" color="accent">
                    Replace Exercise
                  </AppText>
                </Pressable>
              ) : null}
            </View>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: Spacing.xs,
    gap: 0,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LiftFlowColors.border,
  },
  index: {
    width: 24,
    marginTop: 2,
  },
  content: {
    flex: 1,
    gap: Spacing.xs,
  },
});
