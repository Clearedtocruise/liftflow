import type { BaseEntity, PhaseType, RecoveryStatus } from './common';

export type TrainingProgram = BaseEntity & {
  userId: string;
  name: string;
  description?: string;
  durationWeeks?: number;
  isActive: boolean;
};

export type TrainingPhase = BaseEntity & {
  userId: string;
  programId?: string;
  name: string;
  phaseType: PhaseType;
  startDate: string;
  endDate?: string;
  targetMuscleGroups: string[];
  notes?: string;
};

export type WorkoutTemplate = BaseEntity & {
  userId: string;
  name: string;
  description?: string;
  muscleGroups: string[];
  estimatedDurationMinutes?: number;
  exercises: TemplateExercise[];
  isSystem: boolean;
  updatedAt?: string;
};

export type TemplateExercise = {
  exerciseId: string;
  exerciseName: string;
  sets: number;
  repRange?: string;
  restSeconds?: number;
  notes?: string;
};

export type PlannedWorkout = BaseEntity & {
  userId: string;
  templateId?: string;
  trainingPhaseId?: string;
  name: string;
  scheduledDate: string;
  scheduledTime?: string;
  status: import('./common').SessionStatus;
  suggestedMuscleGroups: string[];
  aiRationale?: string;
};

export type RecoveryAssessment = BaseEntity & {
  userId: string;
  assessedAt: string;
  status: RecoveryStatus;
  sleepHours?: number;
  sorenessScore?: number;
  energyScore?: number;
  hrvMs?: number;
  muscleGroups: string[];
  aiAnalysis?: string;
  recommendations: string[];
};

export type SuggestedMuscleGroups = {
  primaryGroups: string[];
  secondaryGroups: string[];
  rationale: string;
  recoveryScore?: number;
};
