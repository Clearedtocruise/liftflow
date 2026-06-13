import { loadCoachContext } from './coachContext.js';
import { loadRecoveryIntelligence } from './loadRecoveryIntelligence.js';
import { loadSmartProgression } from './loadSmartProgression.js';
import { requireAdmin } from './supabase.js';
import type { ProgressionAdjustmentType } from './smartProgressionEngine.js';

export type CoachAdjustmentLabel =
  | 'increase_weight'
  | 'increase_reps'
  | 'increase_sets'
  | 'maintain'
  | 'deload';

export type ExerciseCoachPrescription = {
  exerciseId: string;
  exerciseName: string;
  whySelected: string[];
  targets: {
    sets: number;
    reps: number;
    repRange: string;
    weightKg: number;
    restSeconds: number;
  };
  adjustmentLabel: CoachAdjustmentLabel;
  adjustmentType: ProgressionAdjustmentType | 'increase_sets';
  reason: string;
  detailedReason: string;
  confidence: number;
  contextUsed: {
    goalFocus: string;
    recoveryScore: number;
    readinessScore: number;
    programPhase?: string;
    nutritionAdherencePct?: number;
    equipmentAware: boolean;
    sessionsUsed: number;
  };
};

export type ExercisePrescriptionPlanInput = {
  exerciseId: string;
  exerciseName?: string;
  plannedSets?: number;
  plannedReps?: string;
  plannedRestSeconds?: number;
  notes?: string;
  sessionId?: string;
  currentSessionSets?: Array<{ weightKg: number; reps: number; setNumber?: number; isFailure?: boolean }>;
};

export function mapAdjustmentLabel(
  progressionType: ProgressionAdjustmentType,
  setsDelta: number,
): CoachAdjustmentLabel {
  if (setsDelta > 0) return 'increase_sets';
  if (progressionType === 'progressive_overload') return 'increase_weight';
  if (progressionType === 'rep_progression') return 'increase_reps';
  if (progressionType === 'deload' || progressionType === 'recovery_hold') return 'deload';
  return 'maintain';
}

export function resolveTargetSets(
  plannedSets: number,
  recoveryScore: number,
  readinessScore: number,
  sprintPhase?: string,
  recoveryVolumeMultiplier = 1,
): { sets: number; setsDelta: number; setsReason?: string } {
  let sets = plannedSets;
  let setsDelta = 0;
  let setsReason: string | undefined;

  if (sprintPhase === 'deload' || recoveryScore < 45) {
    sets = Math.max(1, Math.round(plannedSets * 0.75));
    setsDelta = sets - plannedSets;
    setsReason = 'Deload phase or low recovery — reduced set count.';
    return { sets, setsDelta, setsReason };
  }

  if (recoveryVolumeMultiplier < 0.85) {
    sets = Math.max(1, Math.round(plannedSets * recoveryVolumeMultiplier));
    setsDelta = sets - plannedSets;
    setsReason = 'Recovery modifier lowered volume today.';
    return { sets, setsDelta, setsReason };
  }

  if (recoveryScore >= 85 && readinessScore >= 80 && plannedSets < 5) {
    sets = plannedSets + 1;
    setsDelta = 1;
    setsReason = 'High recovery and readiness — one extra quality set.';
    return { sets, setsDelta, setsReason };
  }

  return { sets, setsDelta, setsReason };
}

export function buildWhySelected(input: {
  exerciseName: string;
  notes?: string;
  goalFocus: string;
  sprintPhase?: string;
  equipment?: string[];
  readinessScore: number;
  muscleFresh?: boolean;
}): string[] {
  const lines: string[] = [];
  if (input.notes) lines.push(input.notes);
  lines.push(`Selected for your ${input.goalFocus.replace('_', ' ')} focus and available equipment.`);
  if (input.sprintPhase) {
    lines.push(`Program phase: ${input.sprintPhase.replace(/_/g, ' ')}.`);
  }
  if (input.readinessScore >= 80) {
    lines.push('Muscle readiness is high — good day to push this movement.');
  } else if (input.readinessScore < 55) {
    lines.push('Included with manageable volume while readiness is still rebuilding.');
  }
  if (input.equipment?.length) {
    lines.push('Fits your current equipment setup.');
  }
  return lines.slice(0, 4);
}

function nutritionAdherencePct(caloriesToday: number, caloriesTarget: number, proteinToday: number, proteinTarget: number): number {
  if (!caloriesTarget && !proteinTarget) return 100;
  const calPct = caloriesTarget > 0 ? Math.min(100, (caloriesToday / caloriesTarget) * 100) : 100;
  const proPct = proteinTarget > 0 ? Math.min(100, (proteinToday / proteinTarget) * 100) : 100;
  return Math.round((calPct + proPct) / 2);
}

export async function loadExerciseCoachPrescription(
  userId: string,
  exerciseId: string,
  plan?: Omit<ExercisePrescriptionPlanInput, 'exerciseId'>,
): Promise<ExerciseCoachPrescription> {
  const db = requireAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const [progression, coachCtx, intelligence, profileRes, recoveryRow] = await Promise.all([
    loadSmartProgression(userId, exerciseId, {
      sessionId: plan?.sessionId,
      currentSessionSets: plan?.currentSessionSets,
    }),
    loadCoachContext(userId),
    loadRecoveryIntelligence(userId).catch(() => null),
    db.from('profiles').select('available_equipment').eq('id', userId).maybeSingle(),
    db
      .from('recovery_assessments')
      .select('metadata')
      .eq('user_id', userId)
      .eq('check_in_date', today)
      .maybeSingle(),
  ]);

  const readinessScore = intelligence?.factors.muscleReadinessScore ?? coachCtx.recovery.score ?? 72;
  const recoveryScore = intelligence?.recoveryScore ?? coachCtx.recovery.score ?? 72;
  const recoveryVolumeMultiplier =
    (recoveryRow.data?.metadata as { volumeMultiplier?: number } | null)?.volumeMultiplier ?? 1;
  const sprintPhase = coachCtx.program?.sprintPhase;
  const plannedSets = plan?.plannedSets ?? 3;
  const repRange = plan?.plannedReps ?? `${progression.targetRepRange.min}-${progression.targetRepRange.max}`;
  const plannedRest = plan?.plannedRestSeconds ?? 90;

  const { sets, setsDelta, setsReason } = resolveTargetSets(
    plannedSets,
    recoveryScore,
    readinessScore,
    sprintPhase,
    recoveryVolumeMultiplier,
  );

  const adherence = nutritionAdherencePct(
    coachCtx.nutrition.caloriesToday ?? 0,
    coachCtx.nutrition.caloriesTarget ?? 0,
    coachCtx.nutrition.proteinToday ?? 0,
    coachCtx.nutrition.proteinTarget ?? 0,
  );

  const whySelected = buildWhySelected({
    exerciseName: progression.exerciseName,
    notes: plan?.notes,
    goalFocus: progression.goalFocus,
    sprintPhase,
    equipment: (profileRes.data?.available_equipment as string[] | undefined) ?? [],
    readinessScore,
  });

  let detailedReason = progression.detailedReason;
  if (setsReason) {
    detailedReason = `${detailedReason} ${setsReason}`;
  }
  if (adherence < 60) {
    detailedReason = `${detailedReason} Nutrition adherence is ${adherence}% — prioritize protein and sleep to support this session.`;
  }

  const adjustmentLabel = mapAdjustmentLabel(progression.adjustmentType, setsDelta);

  return {
    exerciseId,
    exerciseName: plan?.exerciseName ?? progression.exerciseName,
    whySelected,
    targets: {
      sets,
      reps: progression.recommended.reps,
      repRange,
      weightKg: progression.recommended.weightKg,
      restSeconds: plannedRest,
    },
    adjustmentLabel,
    adjustmentType: setsDelta > 0 ? 'increase_sets' : progression.adjustmentType,
    reason: setsReason ?? progression.reason,
    detailedReason,
    confidence: progression.confidence,
    contextUsed: {
      goalFocus: progression.goalFocus,
      recoveryScore,
      readinessScore,
      programPhase: sprintPhase,
      nutritionAdherencePct: adherence,
      equipmentAware: Boolean(profileRes.data?.available_equipment?.length),
      sessionsUsed: progression.basedOnSessions,
    },
  };
}

export async function loadWorkoutExercisePrescriptions(
  userId: string,
  exercises: ExercisePrescriptionPlanInput[],
): Promise<ExerciseCoachPrescription[]> {
  const results: ExerciseCoachPrescription[] = [];
  for (const exercise of exercises) {
    if (!exercise.exerciseId) continue;
    results.push(
      await loadExerciseCoachPrescription(userId, exercise.exerciseId, exercise),
    );
  }
  return results;
}
