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
  adjustmentType: string;
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
  loggingMode?: 'weighted' | 'bodyweight' | 'timed' | 'cardio';
  currentSessionSets?: Array<{
    weightKg?: number;
    reps?: number;
    durationSeconds?: number;
    setNumber?: number;
    isFailure?: boolean;
  }>;
};
