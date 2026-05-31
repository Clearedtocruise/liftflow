import type { TrainingGoalId } from '@/constants/trainingGoals';
import type { WeightUnit } from '@/constants/units';

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
  /** Completed sessions, most recent first — excludes current session */
  priorSessions: ProgressionSessionHistory[];
  currentSessionSets: ProgressionSetRecord[];
  goalFocus: ProgressionGoalFocus;
  recoveryScore?: number;
  recoveryVolumeMultiplier?: number;
  plannedSetCount?: number;
  targetRepsOverride?: number;
  weightUnit?: WeightUnit;
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

export type ProgressionContext = {
  fitnessGoals: TrainingGoalId[];
  recoveryScore: number;
  recoveryVolumeMultiplier: number;
};
