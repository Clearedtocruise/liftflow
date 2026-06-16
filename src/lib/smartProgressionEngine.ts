import type { TrainingGoalId } from '@/constants/trainingGoals';
import type { WeightUnit } from '@/constants/units';
import {
  adjustWeightKg,
  displayWeightFromKg,
  roundWeightToDisplayStep,
  weightStepDisplay,
} from '@/lib/unitConversion';

import type {
  ProgressionAdjustmentType,
  ProgressionGoalFocus,
  ProgressionSessionHistory,
  ProgressionSetRecord,
  SmartProgressionInput,
  SmartProgressionRecommendation,
} from '@/types/progression';

const LB_PER_KG = 2.2046226218;

export function resolveGoalFocus(fitnessGoals: string[] | undefined): ProgressionGoalFocus {
  const primary = fitnessGoals?.[0];
  switch (primary) {
    case 'strength':
      return 'strength';
    case 'hypertrophy':
    case 'muscle_gain':
      return 'hypertrophy';
    case 'fat_loss':
    case 'weight_loss':
      return 'fat_loss';
    default:
      if (fitnessGoals?.includes('strength')) return 'strength';
      if (fitnessGoals?.includes('hypertrophy') || fitnessGoals?.includes('muscle_gain')) return 'hypertrophy';
      if (fitnessGoals?.includes('fat_loss') || fitnessGoals?.includes('weight_loss')) return 'fat_loss';
      return 'general';
  }
}

export function getTargetRepRange(goalFocus: ProgressionGoalFocus): { min: number; max: number; target: number } {
  switch (goalFocus) {
    case 'strength':
      return { min: 3, max: 5, target: 5 };
    case 'hypertrophy':
      return { min: 8, max: 12, target: 10 };
    case 'fat_loss':
      return { min: 10, max: 15, target: 12 };
    default:
      return { min: 8, max: 10, target: 8 };
  }
}

export function weightStepKg(unit: WeightUnit = 'lb'): number {
  return unit === 'kg' ? 2.5 : 2.5 / LB_PER_KG;
}

export function roundWeightToStep(kg: number, unit: WeightUnit = 'lb'): number {
  return roundWeightToDisplayStep(kg, unit);
}

export function kgToDisplayWeight(kg: number, unit: WeightUnit): number {
  return displayWeightFromKg(kg, unit);
}

export function formatSetLine(weightKg: number, reps: number, unit: WeightUnit, label?: string): string {
  const w = kgToDisplayWeight(weightKg, unit);
  const suffix = label ? ` ${label}` : '';
  return `${w}${suffix} × ${reps}`;
}

function deriveWorkingWeight(
  lastSessionSets: ProgressionSetRecord[],
  currentSets: ProgressionSetRecord[],
): number {
  if (currentSets.length > 0) {
    return currentSets[currentSets.length - 1]!.weightKg;
  }
  if (lastSessionSets.length === 0) return 0;
  const weights = lastSessionSets.map((s) => s.weightKg).filter((w) => w > 0);
  if (weights.length === 0) return 0;
  return Math.max(...weights);
}

function increaseWeight(kg: number, goalFocus: ProgressionGoalFocus, unit: WeightUnit): number {
  if (kg <= 0) return 0;
  const display = displayWeightFromKg(kg, unit);
  const step = weightStepDisplay(unit);
  const pct = goalFocus === 'strength' ? 0.03 : goalFocus === 'hypertrophy' ? 0.025 : 0.02;
  const steps = Math.max(1, Math.round((display * pct) / step));
  return adjustWeightKg(kg, unit, steps);
}

function decreaseWeight(kg: number, unit: WeightUnit, pct = 0.05): number {
  if (kg <= 0) return 0;
  const display = displayWeightFromKg(kg, unit);
  const step = weightStepDisplay(unit);
  const steps = Math.max(1, Math.round((display * pct) / step));
  return adjustWeightKg(kg, unit, -steps);
}

function countConsecutiveMissedSessions(sessions: ProgressionSessionHistory[], targetReps: number): number {
  let count = 0;
  for (const session of sessions) {
    if (session.sets.length === 0) break;
    const missed = session.sets.some((s) => s.reps < targetReps || s.isFailure);
    if (missed) count += 1;
    else break;
  }
  return count;
}

function sessionHitAllTargets(sets: ProgressionSetRecord[], targetReps: number): boolean {
  return sets.length > 0 && sets.every((s) => s.reps >= targetReps && !s.isFailure);
}

function buildVoiceLines(
  adjustmentType: ProgressionAdjustmentType,
  recommendedWeightKg: number,
  recommendedReps: number,
  previousWeightKg: number,
  unit: WeightUnit,
  reason: string,
  detailedReason: string,
): { voiceNextSetLine: string; voiceWhyLine: string } {
  const recDisplay = kgToDisplayWeight(recommendedWeightKg, unit);
  const prevDisplay = kgToDisplayWeight(previousWeightKg, unit);
  const unitWord = unit === 'kg' ? 'kilograms' : 'pounds';

  let voiceNextSetLine = `Use ${recDisplay} ${unitWord} for ${recommendedReps} reps.`;
  if (adjustmentType === 'progressive_overload' && recommendedWeightKg > previousWeightKg) {
    voiceNextSetLine = `Increase to ${recDisplay} ${unitWord}.`;
  } else if (adjustmentType === 'deload' && recommendedWeightKg < previousWeightKg) {
    voiceNextSetLine = `Reduce to ${recDisplay} ${unitWord}.`;
  } else if (adjustmentType === 'hold' || adjustmentType === 'recovery_hold') {
    voiceNextSetLine = `Stay at ${recDisplay} ${unitWord} for ${recommendedReps} reps.`;
  } else if (adjustmentType === 'rep_progression') {
    voiceNextSetLine = `Keep ${recDisplay} ${unitWord} and aim for ${recommendedReps} reps.`;
  }

  return {
    voiceNextSetLine,
    voiceWhyLine: detailedReason || reason,
  };
}

/** Core progression engine — pure function, no I/O */
export function computeSmartProgression(input: SmartProgressionInput): SmartProgressionRecommendation {
  const {
    exerciseName,
    exerciseId,
    priorSessions,
    currentSessionSets,
    goalFocus,
    recoveryScore = 72,
    recoveryVolumeMultiplier = 1,
    targetRepsOverride,
    weightUnit = 'lb',
  } = input;

  const repRange = getTargetRepRange(goalFocus);
  const targetReps = targetRepsOverride ?? repRange.target;
  const lastSession = priorSessions[0];
  const lastWorkout = lastSession?.sets ?? [];
  const baseWeightKg = deriveWorkingWeight(lastWorkout, currentSessionSets);
  const lastCurrentSet = currentSessionSets[currentSessionSets.length - 1];

  let adjustmentType: ProgressionAdjustmentType = 'hold';
  let recommendedWeightKg = baseWeightKg;
  let recommendedReps = targetReps;
  let reason = 'Maintain current working weight.';
  let detailedReason =
    'Progression is based on your logged history, training goal, and recovery status.';
  let confidence = priorSessions.length > 0 ? 0.85 : 0.55;

  const lastSessionAllHit = sessionHitAllTargets(lastWorkout, targetReps);
  const consecutiveMissed = countConsecutiveMissedSessions(priorSessions, targetReps);

  if (recoveryScore < 50 || recoveryVolumeMultiplier < 0.75) {
    adjustmentType = 'deload';
    recommendedWeightKg = baseWeightKg > 0 ? decreaseWeight(baseWeightKg, weightUnit, 0.1) : 0;
    reason = 'Recovery is low — reduce load ~10% today.';
    detailedReason = `Recovery score is ${recoveryScore}. A lighter session supports adaptation and lowers injury risk while you recover.`;
    confidence = 0.9;
  } else if (currentSessionSets.length === 0) {
    if (lastWorkout.length === 0) {
      reason = 'No prior history — pick a manageable working weight.';
      detailedReason = 'Log this exercise across sessions to unlock personalized load recommendations.';
      recommendedWeightKg = 0;
      confidence = 0.5;
    } else if (consecutiveMissed >= 2) {
      adjustmentType = 'deload';
      recommendedWeightKg = decreaseWeight(baseWeightKg, weightUnit);
      reason = 'Repeated missed reps across recent sessions — reduce load slightly.';
      detailedReason = `The last ${consecutiveMissed} sessions missed your ${targetReps}-rep target. A small deload rebuilds momentum before progressing again.`;
      confidence = 0.88;
    } else if (lastSessionAllHit) {
      if (recoveryScore >= 50 && recoveryScore < 65) {
        adjustmentType = 'recovery_hold';
        recommendedWeightKg = baseWeightKg;
        reason = 'Recovery is moderate — hold load and focus on quality reps.';
        detailedReason = `You hit all targets last session, but recovery (${recoveryScore}) suggests holding load today and progressing next time.`;
      } else if (goalFocus === 'fat_loss') {
        const topSet = lastWorkout.reduce((best, s) => (s.reps > best.reps ? s : best), lastWorkout[0]!);
        if (topSet.reps >= repRange.max) {
          adjustmentType = 'progressive_overload';
          recommendedWeightKg = increaseWeight(baseWeightKg, goalFocus, weightUnit);
          reason = 'Top of rep range achieved — small load increase.';
          detailedReason = `Fat-loss focus prioritizes reps; you hit ${topSet.reps} reps at the top of your range, so a modest load bump keeps stimulus without excess fatigue.`;
        } else {
          adjustmentType = 'rep_progression';
          recommendedWeightKg = baseWeightKg;
          recommendedReps = Math.min(repRange.max, topSet.reps + 1);
          reason = 'Add reps at current weight before increasing load.';
          detailedReason = `Hypertrophy-style rep progression fits fat-loss goals: build to ${repRange.max} reps before adding weight.`;
        }
      } else {
        adjustmentType = 'progressive_overload';
        recommendedWeightKg = increaseWeight(baseWeightKg, goalFocus, weightUnit);
        reason = 'All target reps achieved last session.';
        detailedReason = `Every set hit ${targetReps}+ reps last time. Progressive overload adds stimulus aligned with your ${goalFocus.replace('_', ' ')} focus.`;
        confidence = 0.92;
      }
    } else {
      const lastSet = lastWorkout[lastWorkout.length - 1]!;
      if (lastSet.reps < targetReps) {
        adjustmentType = 'rep_progression';
        recommendedWeightKg = baseWeightKg;
        recommendedReps = Math.min(repRange.max, lastSet.reps + 1);
        reason = 'Build reps at current weight before adding load.';
        detailedReason = `Last session ended at ${lastSet.reps} reps (target ${targetReps}). Rep progression first, then load — standard for sustainable gains.`;
      } else {
        adjustmentType = 'hold';
        recommendedWeightKg = baseWeightKg;
        reason = 'Mixed performance last session — repeat working weight.';
        detailedReason = 'Not every set hit target last time. Consolidate at this load before increasing.';
      }
    }
  } else {
    recommendedWeightKg = lastCurrentSet?.weightKg ?? baseWeightKg;
    const setNum = currentSessionSets.length;

    if (lastCurrentSet && (lastCurrentSet.reps < targetReps || lastCurrentSet.isFailure)) {
      if (lastCurrentSet.reps < targetReps - 2 || lastCurrentSet.isFailure) {
        adjustmentType = 'deload';
        recommendedWeightKg = decreaseWeight(recommendedWeightKg, weightUnit);
        reason = `Set ${setNum} missed target — reduce load for your next set.`;
        detailedReason = `You logged ${lastCurrentSet.reps} reps at ${kgToDisplayWeight(lastCurrentSet.weightKg, weightUnit)} ${weightUnit}. Dropping load helps you finish remaining sets with good form.`;
      } else {
        adjustmentType = 'hold';
        recommendedReps = targetReps;
        reason = `Set ${setNum} slightly under target — hold weight and aim for ${targetReps} reps.`;
        detailedReason = `One rep short is normal fatigue. Same weight with full rest often clears the target on the next set.`;
      }
    } else {
      adjustmentType = 'hold';
      recommendedReps = targetReps;
      reason = `Set ${setNum} on target — stay at this weight for your next set.`;
      detailedReason = `You hit ${lastCurrentSet?.reps ?? targetReps} reps. Consistent sets at the same load build volume before increasing weight.`;
    }
  }

  if (recommendedWeightKg > 0) {
    recommendedWeightKg = roundWeightToStep(recommendedWeightKg, weightUnit);
  }

  const { voiceNextSetLine, voiceWhyLine } = buildVoiceLines(
    adjustmentType,
    recommendedWeightKg,
    recommendedReps,
    baseWeightKg,
    weightUnit,
    reason,
    detailedReason,
  );

  return {
    exerciseName,
    exerciseId,
    lastWorkout: lastWorkout.map((s) => ({ weightKg: s.weightKg, reps: s.reps })),
    lastWorkoutDate: lastSession?.sessionDate,
    recommended: { weightKg: recommendedWeightKg, reps: recommendedReps },
    reason,
    detailedReason,
    voiceNextSetLine,
    voiceWhyLine,
    adjustmentType,
    targetRepRange: { min: repRange.min, max: repRange.max },
    confidence,
    basedOnSessions: priorSessions.length,
    goalFocus,
  };
}

export function mapFitnessGoalsToFocus(goals: TrainingGoalId[] | undefined): ProgressionGoalFocus {
  return resolveGoalFocus(goals);
}
