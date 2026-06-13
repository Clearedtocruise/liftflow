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

export const TRANSFORMATION_BF_PRESETS = [20, 18, 15, 12, 10] as const;

export type ScheduleStatus = 'ahead' | 'on_track' | 'behind' | 'at_goal' | 'unknown';

export type BodyFatMilestone = {
  bodyFatPct: number;
  estimatedDate?: string;
  reached: boolean;
};

export type TransformationStory = {
  currentWeightKg: number;
  currentBodyFatPct: number;
  goalWeightKg: number;
  goalBodyFatPct: number;
  daysRemaining?: number;
  estimatedCompletionDate?: string;
  progressPercent: number;
  startWeightKg?: number;
  startBodyFatPct?: number;
  requiredFatLossKg: number;
  currentPaceKgPerWeek?: number;
  scheduleStatus: ScheduleStatus;
  scheduleLabel: string;
  weeksAhead?: number;
  coachInsights: string[];
  milestones: BodyFatMilestone[];
};
