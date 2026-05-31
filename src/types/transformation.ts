export type TransformationConfidence = 'high' | 'medium' | 'low';

export type PhotoRole = 'before' | 'progress' | 'milestone' | 'current';

export type ComparisonMode = 'before_current' | 'before_projected' | 'current_projected' | 'timeline';

export type BodyCompositionSnapshot = {
  weightKg: number;
  bodyFatPct: number;
  leanMassKg: number;
  fatMassKg: number;
};

export type TransformationProjection = {
  id: string;
  userId: string;
  beforePhotoId?: string;
  currentPhotoId?: string;
  beforePhotoUrl?: string;
  currentPhotoUrl?: string;
  targetBodyFatPct: number;
  current: BodyCompositionSnapshot;
  projected: BodyCompositionSnapshot;
  projectedWeeksToTarget?: number;
  successScore?: number;
  workoutAdherencePct?: number;
  nutritionAdherencePct?: number;
  weightTrend?: string;
  rationale: string;
  confidence: TransformationConfidence;
  engineVersion: string;
  createdAt: string;
};

export const TRANSFORMATION_BF_PRESETS = [20, 15, 12, 10] as const;
