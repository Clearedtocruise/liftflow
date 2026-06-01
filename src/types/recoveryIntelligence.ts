export type RecoveryIntelligenceStatus = 'fully_recovered' | 'recovering' | 'fatigued' | 'overtrained';

export type TrainingDayRecommendation = 'train' | 'train_light' | 'recovery_session' | 'rest_day';

export type RecoveryMuscleGroup = 'chest' | 'back' | 'legs' | 'shoulders' | 'biceps' | 'triceps' | 'core';

export const RECOVERY_MUSCLE_GROUPS: RecoveryMuscleGroup[] = [
  'chest',
  'back',
  'legs',
  'shoulders',
  'biceps',
  'triceps',
  'core',
];

export type MuscleRecoveryState = {
  muscle: RecoveryMuscleGroup;
  label: string;
  score: number;
  status: RecoveryIntelligenceStatus;
  lastTrainedAt?: string;
  hoursSinceTraining?: number;
  weeklyVolume: number;
  weeklySets: number;
};

export type RecoveryIntelligenceFactors = {
  subjectiveScore: number;
  trainingLoadScore: number;
  muscleReadinessScore: number;
  sessionCount3d: number;
  totalVolume3d: number;
  consecutiveTrainingDays: number;
  avgSessionDurationMin: number;
  workoutsLast7d: number;
  sleepHours?: number;
  sorenessLevel?: number;
  /** Reserved for Apple Health / sleep integrations */
  sleepDataAvailable: boolean;
  healthKitAvailable: boolean;
};

export type RecoveryIntelligenceTrendPoint = {
  date: string;
  score: number;
  status: RecoveryIntelligenceStatus;
};

export type RecoveryIntelligenceReport = {
  assessedAt: string;
  recoveryScore: number;
  recoveryStatus: RecoveryIntelligenceStatus;
  recoveryStatusLabel: string;
  trainingRecommendation: TrainingDayRecommendation;
  trainingRecommendationLabel: string;
  rationale: string;
  voiceRecoveryLine: string;
  voiceTrainTodayLine: string;
  muscleRecovery: MuscleRecoveryState[];
  suggestedMuscleGroups: RecoveryMuscleGroup[];
  avoidMuscleGroups: RecoveryMuscleGroup[];
  factors: RecoveryIntelligenceFactors;
  trend: RecoveryIntelligenceTrendPoint[];
};
