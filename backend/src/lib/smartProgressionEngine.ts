/** Smart progression — mirrors src/lib/smartProgressionEngine.ts (keep in sync) */

export type ProgressionGoalFocus = 'strength' | 'hypertrophy' | 'fat_loss' | 'general';

export type ProgressionSetRecord = {
  weightKg: number;
  reps: number;
  setNumber?: number;
  isFailure?: boolean;
};

export type ProgressionSessionHistory = {
  sessionId: string;
  sessionDate: string;
  sets: ProgressionSetRecord[];
  totalVolume: number;
};

export type ProgressionAdjustmentType =
  | 'progressive_overload'
  | 'deload'
  | 'hold'
  | 'rep_progression'
  | 'recovery_hold';

export type SmartProgressionInput = {
  exerciseName: string;
  exerciseId?: string;
  priorSessions: ProgressionSessionHistory[];
  currentSessionSets: ProgressionSetRecord[];
  goalFocus: ProgressionGoalFocus;
  recoveryScore?: number;
  recoveryVolumeMultiplier?: number;
  targetRepsOverride?: number;
  weightUnit?: 'lb' | 'kg';
};

export type SmartProgressionRecommendation = {
  exerciseName: string;
  exerciseId?: string;
  lastWorkout: { weightKg: number; reps: number }[];
  lastWorkoutDate?: string;
  recommended: { weightKg: number; reps: number };
  reason: string;
  detailedReason: string;
  voiceNextSetLine: string;
  voiceWhyLine: string;
  adjustmentType: ProgressionAdjustmentType;
  targetRepRange: { min: number; max: number };
  confidence: number;
  basedOnSessions: number;
  goalFocus: ProgressionGoalFocus;
};

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

export function weightStepKg(unit: 'lb' | 'kg' = 'lb'): number {
  return unit === 'kg' ? 2.5 : 2.5 / LB_PER_KG;
}

export function roundWeightToStep(kg: number, unit: 'lb' | 'kg' = 'lb'): number {
  const step = weightStepKg(unit);
  return Math.round(kg / step) * step;
}

function kgToDisplayWeight(kg: number, unit: 'lb' | 'kg'): number {
  if (unit === 'kg') {
    const v = Math.round(kg * 10) / 10;
    return v % 1 === 0 ? Math.round(v) : v;
  }
  return Math.round(kg * LB_PER_KG);
}

function deriveWorkingWeight(lastSessionSets: ProgressionSetRecord[], currentSets: ProgressionSetRecord[]): number {
  if (currentSets.length > 0) return currentSets[currentSets.length - 1]!.weightKg;
  if (lastSessionSets.length === 0) return 0;
  const weights = lastSessionSets.map((s) => s.weightKg).filter((w) => w > 0);
  return weights.length === 0 ? 0 : Math.max(...weights);
}

function increaseWeight(kg: number, goalFocus: ProgressionGoalFocus, unit: 'lb' | 'kg'): number {
  if (kg <= 0) return 0;
  const pct = goalFocus === 'strength' ? 0.03 : goalFocus === 'hypertrophy' ? 0.025 : 0.02;
  const step = weightStepKg(unit);
  const delta = Math.max(step, Math.round(kg * pct / step) * step);
  return roundWeightToStep(kg + delta, unit);
}

function decreaseWeight(kg: number, unit: 'lb' | 'kg', pct = 0.05): number {
  if (kg <= 0) return 0;
  const step = weightStepKg(unit);
  const delta = Math.max(step, Math.round(kg * pct / step) * step);
  return Math.max(step, roundWeightToStep(kg - delta, unit));
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
  unit: 'lb' | 'kg',
  reason: string,
  detailedReason: string,
): { voiceNextSetLine: string; voiceWhyLine: string } {
  const recDisplay = kgToDisplayWeight(recommendedWeightKg, unit);
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

  return { voiceNextSetLine, voiceWhyLine: detailedReason || reason };
}

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
  let detailedReason = 'Progression is based on your logged history, training goal, and recovery status.';
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
