import type { RecoveryStatus } from './common';

export type DailyRecoveryCheckIn = {
  id: string;
  userId: string;
  checkInDate: string;
  assessedAt: string;
  status: RecoveryStatus;
  sleepHours?: number;
  sleepQuality?: number;
  energyLevel?: number;
  stressLevel?: number;
  sorenessLevel?: number;
  recoveryScore: number;
  dailyRecommendation: string;
  recoveryModeActive: boolean;
  volumeMultiplier?: number;
  intensityMultiplier?: number;
};

export type RecoveryTrendPoint = {
  checkInDate: string;
  recoveryScore: number;
  dailyRecommendation?: string;
  recoveryModeActive: boolean;
  status: RecoveryStatus;
};

export type WeeklyCoachCheckIn = {
  id: string;
  userId: string;
  weekStartDate: string;
  weightKg?: number;
  waistCm?: number;
  compliancePct?: number;
  energyScore?: number;
  sleepScore?: number;
  analysis?: string;
  recommendations: string[];
  createdAt: string;
};

export type LimitationType = 'injury' | 'pain' | 'tightness' | 'mobility' | 'discomfort';

export type TrainingLimitation = {
  id: string;
  userId: string;
  limitationType: LimitationType;
  bodyArea: string;
  severity?: number;
  painScore?: number;
  isDiagnosed: boolean;
  description?: string;
  movementRestrictions: string[];
  affectedMovements: string[];
  isActive: boolean;
  createdAt: string;
};

export type AdaptiveMacroTargets = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  rationale: string;
  workoutType?: string;
  recoveryScore?: number;
};

export type DailyMealPlan = {
  date: string;
  macros: AdaptiveMacroTargets;
  meals: Array<{
    mealType: string;
    name: string;
    scheduledDate: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  }>;
  rationale: string;
  recoveryScore?: number;
};
