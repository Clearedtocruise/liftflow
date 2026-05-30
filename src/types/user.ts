import type { EquipmentId, TrainingGoalId, TrainingLocationId } from '@/constants/trainingProfile';
import type { BaseEntity, ConfirmationMode, PreferredUnits, TrainingExperience } from './common';

export type TrainingLocation = TrainingLocationId;
export type TrainingGoal = TrainingGoalId;

export type UserProfile = BaseEntity & {
  email: string;
  displayName?: string;
  avatarUrl?: string;
  dateOfBirth?: string;
  sex?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  heightCm?: number;
  weightKg?: number;
  bodyFatPct?: number;
  trainingExperience?: TrainingExperience;
  fitnessGoals?: string[];
  preferredUnits: PreferredUnits;
  confirmationMode: ConfirmationMode;
  timezone?: string;
  trainingLocation?: TrainingLocation;
  /** User's gym name, e.g. "Gold's Gym Downtown" */
  primaryGymName?: string;
  availableEquipment?: EquipmentId[];
  primaryTrainingGoal?: TrainingGoal;
  onboardingCompleted: boolean;
  updatedAt?: string;
};

export type UserPreferences = BaseEntity & {
  userId: string;
  restTimerSound: boolean;
  restTimerHaptics: boolean;
  voiceFeedback: boolean;
  showAds: boolean;
  shareAnalytics: boolean;
  printerFriendlyDefault: boolean;
  notificationPreferences: Record<string, boolean>;
  coachingPreferences: Record<string, unknown>;
  privacySettings: Record<string, unknown>;
};

export type UserMetric = BaseEntity & {
  userId: string;
  recordedAt: string;
  weightKg?: number;
  heightCm?: number;
  bodyFatPct?: number;
  muscleMassKg?: number;
  restingHeartRate?: number;
  vo2Max?: number;
  source: string;
  notes?: string;
};

export type AuthState = {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
};

export type SignUpPayload = {
  email: string;
  password: string;
  displayName?: string;
};

export type SignInPayload = {
  email: string;
  password: string;
};

export type PasswordResetPayload = {
  email: string;
};

export type LegalAcceptance = BaseEntity & {
  userId: string;
  documentType: import('./common').LegalDocumentType;
  version: string;
  acceptedAt: string;
};
