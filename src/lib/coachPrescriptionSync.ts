import type { ExerciseCoachPrescription } from '@/types/exerciseCoach';

type SessionSetLike = {
  weightKg?: number;
  reps?: number;
  setNumber?: number;
};

/** Stable key for when in-session coach should refresh (set count + last set). */
export function sessionSetsSignature(sets: SessionSetLike[]): string {
  if (sets.length === 0) return '0';
  const last = sets[sets.length - 1]!;
  return `${sets.length}:${last.weightKg ?? 0}:${last.reps ?? 0}:${last.setNumber ?? sets.length}`;
}

export function coachPrescriptionsEqual(
  a: ExerciseCoachPrescription | null | undefined,
  b: ExerciseCoachPrescription | null | undefined,
): boolean {
  if (!a || !b) return a === b;
  return (
    a.adjustmentLabel === b.adjustmentLabel &&
    a.adjustmentType === b.adjustmentType &&
    a.targets.sets === b.targets.sets &&
    a.targets.reps === b.targets.reps &&
    a.targets.weightKg === b.targets.weightKg &&
    a.reason === b.reason &&
    a.detailedReason === b.detailedReason
  );
}
