import type { BaseEntity, PhaseType, RecoveryStatus } from './common';

export type TrainingProgram = BaseEntity & {
  userId: string;
  name: string;
  description?: string;
  durationWeeks?: number;
  isActive: boolean;
  metadata?: Record<string, unknown>;
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
  metadata?: Record<string, unknown>;
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
  exerciseId?: string;
  exerciseName?: string;
  name?: string;
  sets: number;
  repRange?: string;
  reps?: string;
  weightLbs?: number;
  restSeconds?: number;
  notes?: string;
  /** Sprint 2 — workout execution mode for this exercise. */
  executionMode?: import('./workoutExecutionMode').WorkoutExecutionMode;
  /** Exercises sharing an id are performed as a superset (back-to-back sets). */
  supersetGroupId?: string;
};

export type PlannedWorkoutMetadata = {
  programId?: string;
  weekNumber?: number;
  dayIndex?: number;
  dayLabel?: string;
  slotLabel?: string;
  sprintPhase?: string;
  /** Default Sprint 2 execution mode for exercises in this workout. */
  executionMode?: import('./workoutExecutionMode').WorkoutExecutionMode;
  exercises?: TemplateExercise[];
  plannedVolume?: number;
  locationId?: string;
  locationName?: string;
  rescheduledFrom?: string;
  rescheduledAt?: string;
  recoveryAdjusted?: boolean;
  limitationAdjusted?: boolean;
  sessionKind?: 'strength' | 'cardio' | 'mobility';
  cardioType?: string;
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
  metadata?: PlannedWorkoutMetadata;
};

export type ProgramType =
  | 'push_pull_legs'
  | 'upper_lower'
  | 'full_body'
  | 'body_part_split'
  | 'strength';

export type ProgramFrequency = 3 | 4 | 5 | 6 | 7 | 'custom';

export type CreateProgramPayload = {
  programType: ProgramType;
  frequency: ProgramFrequency;
  goal?: string;
  experience?: string;
  durationWeeks?: number;
  equipment?: string[];
  locationId?: string;
  locationName?: string;
  customSchedule?: string[];
};

export type ProgramDashboard = {
  program: TrainingProgram;
  phase: TrainingPhase | null;
  currentWeek: number;
  completionPct: number;
  nextWorkout: PlannedWorkout | null;
  upcomingWorkouts: PlannedWorkout[];
  totalPlanned: number;
  totalCompleted: number;
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
