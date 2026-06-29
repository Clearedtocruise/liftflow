import type {
    BaseEntity,
    BlockType,
    MovementCategory,
    SessionStatus,
    SetType,
} from './common';
import type { ExerciseType } from './exerciseClassification';

export type Exercise = BaseEntity & {
  name: string;
  slug?: string;
  category: MovementCategory;
  exerciseType: ExerciseType;
  equipment: string;
  muscleGroups: string[];
  secondaryMuscles?: string[];
  tutorialUrl?: string;
  instructions?: string;
  isSystem: boolean;
  createdBy?: string;
};

export type WorkoutSet = BaseEntity & {
  workoutExerciseId: string;
  setNumber: number;
  weight?: number;
  reps?: number;
  rpe?: number;
  type: SetType;
  durationSeconds?: number;
  distanceMeters?: number;
  timeUnderTensionSeconds?: number;
  restSeconds?: number;
  isPr?: boolean;
  notes?: string;
  loggedAt: string;
  /** Optimistic local set — queued for server sync after network failure. */
  pendingSync?: boolean;
};

export type WorkoutExercise = BaseEntity & {
  sessionId: string;
  blockId?: string;
  exerciseId: string;
  exercise?: Exercise;
  sortOrder: number;
  suggestedWeight?: number;
  suggestedReps?: string;
  sets: WorkoutSet[];
  isActive?: boolean;
  notes?: string;
};

export type WorkoutBlock = BaseEntity & {
  sessionId: string;
  blockType: BlockType;
  sortOrder: number;
  restSeconds?: number;
  exercises: WorkoutExercise[];
  notes?: string;
};

export type WorkoutSession = BaseEntity & {
  userId: string;
  name: string;
  status: SessionStatus;
  plannedWorkoutId?: string;
  trainingPhaseId?: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  totalVolume?: number;
  totalSets?: number;
  blocks: WorkoutBlock[];
  exercises: WorkoutExercise[];
  notes?: string;
  isActive: boolean;
};

export type RestPeriod = BaseEntity & {
  sessionId: string;
  workoutSetId?: string;
  recommendedSeconds?: number;
  actualSeconds?: number;
  startedAt: string;
  endedAt?: string;
  wasSkipped: boolean;
};

export type WorkoutDensityMetrics = BaseEntity & {
  sessionId: string;
  totalWorkSeconds?: number;
  totalRestSeconds?: number;
  setsPerMinute?: number;
  volumePerMinute?: number;
  densityScore?: number;
  calculatedAt: string;
};

export type WorkoutHistoryItem = {
  id: string;
  name: string;
  date: string;
  durationMinutes: number;
  exerciseCount: number;
  totalSets: number;
  totalVolume: number;
  prCount?: number;
  status: SessionStatus;
  sessionKind?: 'strength' | 'cardio';
  cardioType?: string;
  distanceMeters?: number;
  caloriesBurned?: number;
  avgHeartRate?: number;
  notes?: string;
};

export type ParsedVoiceCommand = {
  exercise?: string;
  weight?: number;
  reps?: number;
  set?: number;
  type?: SetType;
  confidence?: number;
  rawText: string;
  intent?: 'log_set' | 'completed_set' | 'adjust_weight' | 'feedback' | 'undo_last_set' | 'delete_last_set' | 'next_set' | 'declare_exercise';
  feedback?: 'easy' | 'hard' | 'failed';
  weightAdjustment?: 'increase' | 'decrease';
  targetWeight?: number;
  weightUnit?: 'lb' | 'kg';
  usesContextWeight?: boolean;
  usesContextExercise?: boolean;
};

export type VoiceLogEntry = BaseEntity & {
  userId: string;
  sessionId?: string;
  rawTranscript: string;
  audioUrl?: string;
  status: import('./common').VoiceCommandStatus;
  confidence?: number;
  parsedData?: ParsedVoiceCommand;
};

export type CreateSetPayload = {
  workoutExerciseId: string;
  weight?: number;
  reps?: number;
  type?: SetType;
  durationSeconds?: number;
  distanceMeters?: number;
  restSeconds?: number;
  skipRest?: boolean;
};

export type UpdateSetPayload = {
  weight?: number;
  reps?: number;
  type?: SetType;
  rpe?: number;
  notes?: string;
};

export type StartSessionPayload = {
  name: string;
  templateId?: string;
  plannedWorkoutId?: string;
  gymName?: string;
  trainingLocation?: string;
  workoutLocationId?: string;
  exercisePlan?: import('./workoutExecution').EditableWorkoutExercise[];
};
