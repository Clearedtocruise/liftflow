import type { EquipmentId } from '@/constants/equipmentCatalog';
import type { CoachProfileMetadata } from '@/constants/onboardingCoach';
import type { NutritionGoal, TrainingGoalId } from '@/constants/trainingGoals';
import type { TrainingLocationId } from '@/constants/trainingProfile';
import type {
    BaseEntity,
    ConfirmationMode,
    DistanceUnit,
    HeightUnit,
    MeasurementUnit,
    PreferredUnits,
    TrainingExperience,
    WaterUnit,
    WeightUnit,
} from './common';

export type TrainingLocation = TrainingLocationId;
/** Highest-priority nutrition goal (derived from fitnessGoals[0]) */
export type TrainingGoal = NutritionGoal;

export type UserProfileMetadata = {
  coachProfile?: CoachProfileMetadata;
  coachActivation?: {
    activatedAt?: string;
    coachMessage?: string;
    supplementRecommendations?: Array<{ name: string; rationale: string; priority: string }>;
    programType?: string;
    frequency?: number | string;
  };
};

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
  /** Ordered by priority — index 0 drives nutrition; all influence programming */
  fitnessGoals?: TrainingGoalId[];
  preferredUnits: PreferredUnits;
  preferredHeightUnit?: HeightUnit;
  preferredWeightUnit?: WeightUnit;
  preferredDistanceUnit?: DistanceUnit;
  preferredMeasurementUnit?: MeasurementUnit;
  preferredWaterUnit?: WaterUnit;
  confirmationMode: ConfirmationMode;
  timezone?: string;
  trainingLocation?: TrainingLocation;
  /** User's gym name, e.g. "Gold's Gym Downtown" */
  primaryGymName?: string;
  availableEquipment?: EquipmentId[];
  /** Nutrition driver — synced from fitnessGoals[0] */
  primaryTrainingGoal?: TrainingGoal;
  onboardingCompleted: boolean;
  /** Full premium without subscription (Build 156A). */
  isFounder?: boolean;
  /** Full premium without subscription (Build 156A). */
  isBetaTester?: boolean;
  /** Legacy Sprint 8.5 beta ops — still honored for beta override. */
  isInternalTester?: boolean;
  betaTesterTag?: string;
  betaInviteCode?: string;
  metadata?: UserProfileMetadata;
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
