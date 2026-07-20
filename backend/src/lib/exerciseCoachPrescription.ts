import { loadCoachContext } from './coachContext.js';
import { classifyExercise, type ExerciseType } from './exerciseClassification.js';
import { loadRecoveryIntelligence } from './loadRecoveryIntelligence.js';
import { loadSmartProgression } from './loadSmartProgression.js';
import {
  trainingRecommendationLabel,
  type TrainingDayRecommendation,
} from './recoveryIntelligenceEngine.js';
import type { ProgressionAdjustmentType } from './smartProgressionEngine.js';
import { resolveGoalFocus } from './smartProgressionEngine.js';
import { requireAdmin } from './supabase.js';
import { coerceTrainingRecommendationForSchedule } from './workoutRecommendationEngine.js';
import {
    computeTimedProgression,
    isTimedRepRange,
    parseTargetDurationSeconds,
    type TimedSetRecord,
} from './timedProgressionEngine.js';

export type CoachAdjustmentLabel =
  | 'increase_weight'
  | 'increase_reps'
  | 'increase_sets'
  | 'increase_duration'
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
    durationSeconds?: number;
    restSeconds: number;
  };
  adjustmentLabel: CoachAdjustmentLabel;
  adjustmentType: ProgressionAdjustmentType | CoachAdjustmentLabel;
  reason: string;
  detailedReason: string;
  confidence: number;
  contextUsed: {
    goalFocus: string;
    recoveryScore: number;
    readinessScore: number;
    trainingRecommendation: TrainingDayRecommendation;
    trainingLabel: string;
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
  loggingMode?: 'weighted' | 'bodyweight' | 'timed' | 'cardio';
  currentSessionSets?: Array<{
    weightKg?: number;
    reps?: number;
    durationSeconds?: number;
    setNumber?: number;
    isFailure?: boolean;
  }>;
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
  trainingRecommendation: TrainingDayRecommendation = 'train',
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

  if (
    trainingRecommendation === 'train' &&
    recoveryScore >= 85 &&
    readinessScore >= 80 &&
    plannedSets < 5
  ) {
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
  recoveryScore: number;
  readinessScore: number;
  muscleFresh?: boolean;
  trainingRecommendation?: string;
}): string[] {
  const lines: string[] = [];
  if (input.notes) lines.push(input.notes);
  lines.push(`Selected for your ${input.goalFocus.replace('_', ' ')} focus and available equipment.`);
  if (input.sprintPhase) {
    lines.push(`Program phase: ${input.sprintPhase.replace(/_/g, ' ')}.`);
  }
  if (input.trainingRecommendation === 'train_light') {
    lines.push('Recovery suggests training light — keep effort moderate and leave reps in reserve.');
  } else if (input.trainingRecommendation === 'recovery_session') {
    lines.push('Included at reduced intensity while recovery is still rebuilding.');
  } else if (input.trainingRecommendation === 'rest_day') {
    lines.push('Recovery is low — keep this session easy and prioritize quality over load.');
  } else if (input.recoveryScore >= 75 && input.readinessScore >= 80) {
    lines.push('Muscle readiness is high — good day to push this movement.');
  } else if (input.readinessScore < 55 || input.recoveryScore < 55) {
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

function scoreFallbackTrainingRecommendation(score: number): TrainingDayRecommendation {
  if (score >= 75) return 'train';
  if (score >= 55) return 'train_light';
  if (score >= 40) return 'recovery_session';
  return 'rest_day';
}

/** Same guidance as home dashboard — scheduled workout adjusts intensity, not assignment. */
function resolveActiveWorkoutTrainingGuidance(
  intelligence: Awaited<ReturnType<typeof loadRecoveryIntelligence>> | null,
  recoveryScore: number,
): { recommendation: TrainingDayRecommendation; label: string } {
  const raw =
    intelligence?.trainingRecommendation ?? scoreFallbackTrainingRecommendation(recoveryScore);
  const recommendation = coerceTrainingRecommendationForSchedule(
    raw,
    true,
  ) as TrainingDayRecommendation;
  return {
    recommendation,
    label:
      intelligence?.trainingRecommendationLabel && recommendation === raw
        ? intelligence.trainingRecommendationLabel
        : trainingRecommendationLabel(recommendation),
  };
}

async function loadExerciseType(
  exerciseId: string,
  plannedReps?: string,
  exerciseName?: string,
): Promise<ExerciseType> {
  const db = requireAdmin();
  const { data } = await db
    .from('exercises')
    .select('name, slug, exercise_type, equipment, category')
    .eq('id', exerciseId)
    .maybeSingle();

  if (isTimedRepRange(plannedReps)) return 'timed';

  if (!data) {
    return classifyExercise({ name: exerciseName ?? 'Exercise' });
  }

  return classifyExercise({
    slug: data.slug,
    name: data.name ?? exerciseName ?? 'Exercise',
    equipment: data.equipment,
    movementCategory: data.category,
    exerciseType: data.exercise_type as ExerciseType | null,
  });
}

type TimedSetRow = {
  duration_seconds: number | null;
  set_number: number | null;
  logged_at: string;
  workout_exercises: {
    exercise_id: string;
    workout_sessions: { id: string; started_at: string; status: string };
  };
};

async function loadTimedSessionHistory(
  userId: string,
  exerciseId: string,
  sessionId?: string,
): Promise<TimedSetRecord[][]> {
  const db = requireAdmin();
  const { data } = await db
    .from('workout_sets')
    .select(
      'duration_seconds, set_number, logged_at, workout_exercises!inner(exercise_id, workout_sessions!inner(id, started_at, status, user_id))',
    )
    .eq('workout_exercises.exercise_id', exerciseId)
    .eq('workout_exercises.workout_sessions.user_id', userId)
    .eq('workout_exercises.workout_sessions.status', 'completed')
    .not('duration_seconds', 'is', null)
    .order('logged_at', { ascending: false })
    .limit(200);

  const bySession = new Map<string, TimedSetRecord[]>();
  for (const row of (data ?? []) as unknown as TimedSetRow[]) {
    const session = row.workout_exercises.workout_sessions;
    if (sessionId && session.id === sessionId) continue;
    const durationSeconds = row.duration_seconds ?? 0;
    if (durationSeconds <= 0) continue;

    const set: TimedSetRecord = {
      durationSeconds,
      setNumber: row.set_number ?? undefined,
    };
    const existing = bySession.get(session.id);
    if (!existing) bySession.set(session.id, [set]);
    else existing.push(set);
  }

  return [...bySession.values()]
    .map((sets) => sets.sort((a, b) => (a.setNumber ?? 0) - (b.setNumber ?? 0)))
    .slice(0, 8);
}

async function loadTimedExerciseCoachPrescription(
  userId: string,
  exerciseId: string,
  plan?: Omit<ExercisePrescriptionPlanInput, 'exerciseId'>,
): Promise<ExerciseCoachPrescription> {
  const db = requireAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const [coachCtx, intelligence, profileRes, recoveryRow, priorSessions] = await Promise.all([
    loadCoachContext(userId),
    loadRecoveryIntelligence(userId).catch(() => null),
    db.from('profiles').select('available_equipment, fitness_goals').eq('id', userId).maybeSingle(),
    db
      .from('recovery_assessments')
      .select('metadata')
      .eq('user_id', userId)
      .eq('check_in_date', today)
      .maybeSingle(),
    loadTimedSessionHistory(userId, exerciseId, plan?.sessionId),
  ]);

  const readinessScore = intelligence?.factors.muscleReadinessScore ?? coachCtx.recovery.score ?? 72;
  const recoveryScore = intelligence?.recoveryScore ?? coachCtx.recovery.score ?? 72;
  const { recommendation: effectiveTrainingRec, label: trainingLabel } =
    resolveActiveWorkoutTrainingGuidance(intelligence, recoveryScore);
  const sprintPhase = coachCtx.program?.sprintPhase;
  const plannedSets = plan?.plannedSets ?? 3;
  const repRange = plan?.plannedReps ?? '30 sec';
  const plannedRest = plan?.plannedRestSeconds ?? 90;
  const targetDurationSeconds = parseTargetDurationSeconds(repRange);

  const currentSessionSets: TimedSetRecord[] = (plan?.currentSessionSets ?? [])
    .map((set) => ({
      durationSeconds: set.durationSeconds ?? 0,
      setNumber: set.setNumber,
    }))
    .filter((set) => set.durationSeconds > 0);

  const timed = computeTimedProgression({
    targetDurationSeconds,
    priorSessionSets: priorSessions,
    currentSessionSets,
  });

  const adherence = nutritionAdherencePct(
    coachCtx.nutrition.caloriesToday ?? 0,
    coachCtx.nutrition.caloriesTarget ?? 0,
    coachCtx.nutrition.proteinToday ?? 0,
    coachCtx.nutrition.proteinTarget ?? 0,
  );

  const goalFocus = resolveGoalFocus(profileRes.data?.fitness_goals as string[] | undefined);

  const whySelected = buildWhySelected({
    exerciseName: plan?.exerciseName ?? 'Timed hold',
    notes: plan?.notes,
    goalFocus,
    sprintPhase,
    equipment: (profileRes.data?.available_equipment as string[] | undefined) ?? [],
    recoveryScore,
    readinessScore,
    trainingRecommendation: effectiveTrainingRec,
  });

  let detailedReason = timed.detailedReason;
  if (adherence < 60) {
    detailedReason = `${detailedReason} Nutrition adherence is ${adherence}% — prioritize protein and sleep to support this session.`;
  }

  return {
    exerciseId,
    exerciseName: plan?.exerciseName ?? 'Timed hold',
    whySelected,
    targets: {
      sets: plannedSets,
      reps: 0,
      repRange,
      weightKg: 0,
      durationSeconds: timed.recommendedDurationSeconds,
      restSeconds: plannedRest,
    },
    adjustmentLabel: timed.adjustmentLabel,
    adjustmentType: timed.adjustmentLabel,
    reason: timed.reason,
    detailedReason,
    confidence: timed.confidence,
    contextUsed: {
      goalFocus,
      recoveryScore,
      readinessScore,
      trainingRecommendation: effectiveTrainingRec,
      trainingLabel,
      programPhase: sprintPhase,
      nutritionAdherencePct: adherence,
      equipmentAware: Boolean(profileRes.data?.available_equipment?.length),
      sessionsUsed: timed.basedOnSessions,
    },
  };
}

export async function loadExerciseCoachPrescription(
  userId: string,
  exerciseId: string,
  plan?: Omit<ExercisePrescriptionPlanInput, 'exerciseId'>,
): Promise<ExerciseCoachPrescription> {
  const exerciseType = await loadExerciseType(exerciseId, plan?.plannedReps, plan?.exerciseName);
  const isTimed =
    plan?.loggingMode === 'timed' || exerciseType === 'timed' || isTimedRepRange(plan?.plannedReps);

  if (isTimed) {
    return loadTimedExerciseCoachPrescription(userId, exerciseId, plan);
  }

  const db = requireAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const [progression, coachCtx, intelligence, profileRes, recoveryRow] = await Promise.all([
    loadSmartProgression(userId, exerciseId, {
      sessionId: plan?.sessionId,
      currentSessionSets: plan?.currentSessionSets?.map((set) => ({
        weightKg: set.weightKg ?? 0,
        reps: set.reps ?? 0,
        setNumber: set.setNumber,
        isFailure: set.isFailure,
      })),
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
  const { recommendation: effectiveTrainingRec, label: trainingLabel } =
    resolveActiveWorkoutTrainingGuidance(intelligence, recoveryScore);
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
    effectiveTrainingRec,
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
    recoveryScore,
    readinessScore,
    trainingRecommendation: effectiveTrainingRec,
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
      trainingRecommendation: effectiveTrainingRec,
      trainingLabel,
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
  const jobs = exercises
    .filter((exercise) => Boolean(exercise.exerciseId))
    .map((exercise) => loadExerciseCoachPrescription(userId, exercise.exerciseId, exercise));
  return Promise.all(jobs);
}
