import type { BaseEntity, GoalStatus, GoalType, PhotoAngle } from './common';

export type BodyCompositionRecord = BaseEntity & {
  userId: string;
  recordedAt: string;
  weightKg?: number;
  bodyFatPct?: number;
  leanMassKg?: number;
  waistCm?: number;
  chestCm?: number;
  hipsCm?: number;
  armsCm?: number;
  thighsCm?: number;
  estimationMethod?: string;
  notes?: string;
};

export type ProgressPhoto = BaseEntity & {
  userId: string;
  photoUrl: string;
  thumbnailUrl?: string;
  angle: PhotoAngle;
  takenAt: string;
  weightKg?: number;
  notes?: string;
  isPrivate: boolean;
};

export type PhotoComparison = BaseEntity & {
  userId: string;
  beforePhotoId: string;
  afterPhotoId: string;
  beforePhoto?: ProgressPhoto;
  afterPhoto?: ProgressPhoto;
  title?: string;
  notes?: string;
};

export type PhysiqueProjection = BaseEntity & {
  userId: string;
  sourcePhotoId?: string;
  projectedImageUrl?: string;
  targetDate?: string;
  targetBodyFatPct?: number;
  aiModelVersion?: string;
  disclaimerAcknowledged: boolean;
};

export type Goal = BaseEntity & {
  userId: string;
  goalType: GoalType;
  title: string;
  description?: string;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  status: GoalStatus;
  targetDate?: string;
  completedAt?: string;
  milestones: GoalMilestone[];
  updatedAt?: string;
};

export type GoalMilestone = {
  id: string;
  title: string;
  targetValue?: number;
  achievedAt?: string;
  sortOrder: number;
};

export type AnalyticsSnapshot = BaseEntity & {
  userId: string;
  snapshotDate: string;
  periodType: 'daily' | 'weekly' | 'monthly' | 'yearly';
  metrics: AnalyticsMetrics;
};

export type AnalyticsMetrics = {
  totalWorkouts?: number;
  totalVolume?: number;
  totalSets?: number;
  avgWorkoutDuration?: number;
  consistencyStreak?: number;
  prCount?: number;
  avgRestTime?: number;
  workoutDensity?: number;
  pushPullRatio?: number;
  muscleGroupVolume?: Record<string, number>;
  estimated1rmTrends?: Record<string, number>;
};

export type PerformanceTrend = BaseEntity & {
  userId: string;
  exerciseId?: string;
  trendType: string;
  periodStart: string;
  periodEnd: string;
  dataPoints: { date: string; value: number }[];
  estimated1rm?: number;
  volumeChangePct?: number;
  consistencyStreak?: number;
};

export type DashboardSummary = {
  streak: number;
  weeklyWorkouts: number;
  weeklyVolume: number;
  activeGoals: number;
  recoveryStatus: import('./common').RecoveryStatus;
  recentPrs: number;
  nextSuggestedWorkout?: string;
  currentWeightKg?: number;
  goalWeightKg?: number;
  caloriesToday: number;
  proteinToday: number;
  recentWorkouts: import('./workout').WorkoutHistoryItem[];
  weightHistory: { date: string; weightKg: number }[];
};
