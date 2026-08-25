/**
 * Shared enums and utility types used across all ONE MORE domains.
 * Mirror PostgreSQL enums in supabase/schema.sql — keep in sync.
 */

export type TrainingExperience = 'beginner' | 'intermediate' | 'advanced' | 'elite';
export type ConfirmationMode = 'always' | 'smart' | 'none';
export type LegalDocumentType = 'terms' | 'privacy' | 'liability' | 'ai_disclaimer' | 'health_disclaimer';
export type MovementCategory = 'push' | 'pull' | 'squat' | 'hinge' | 'carry' | 'cardio' | 'core' | 'other';
export type SetType = 'normal' | 'warmup' | 'dropset' | 'failure' | 'rest_pause' | 'amrap' | 'tempo';
export type BlockType = 'standard' | 'superset' | 'giant_set' | 'circuit' | 'drop_set' | 'rest_pause';
export type SessionStatus = 'planned' | 'active' | 'paused' | 'completed' | 'cancelled';
export type PhaseType = 'hypertrophy' | 'strength' | 'power' | 'endurance' | 'deload' | 'maintenance' | 'cut' | 'custom';
export type RecoveryStatus = 'optimal' | 'moderate' | 'fatigued' | 'overreached' | 'unknown';
export type CardioType = 'run' | 'walk' | 'cycle' | 'row' | 'swim' | 'hiit' | 'treadmill' | 'elliptical' | 'other';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'pre_workout' | 'post_workout';
export type GoalType = 'strength' | 'endurance' | 'body_composition' | 'weight_loss' | 'muscle_gain' | 'habit' | 'custom';
export type GoalStatus = 'active' | 'completed' | 'paused' | 'abandoned';
export type SubscriptionTier = 'free' | 'basic' | 'premium' | 'premium_plus';
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'cancelled' | 'expired';
export type NotificationType = 'workout_reminder' | 'rest_timer' | 'coaching' | 'goal' | 'recovery' | 'subscription' | 'system';
export type ExportFormat = 'pdf' | 'csv' | 'json' | 'print';
export type ExportContentType =
  | 'workout'
  | 'workout_plan'
  | 'training_report'
  | 'analytics_dashboard'
  | 'meal_plan'
  | 'grocery_list'
  | 'progress_summary'
  | 'body_composition'
  | 'goal_report'
  | 'coaching_summary'
  | 'custom';
export type IntegrationProvider = 'apple_healthkit' | 'apple_watch' | 'strava' | 'google_fit';
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';
export type AIRecommendationType =
  | 'workout'
  | 'exercise'
  | 'weight'
  | 'reps'
  | 'rest'
  | 'recovery'
  | 'muscle_group'
  | 'training_phase'
  | 'nutrition'
  | 'hydration'
  | 'coaching_insight';
export type VoiceCommandStatus = 'pending' | 'parsed' | 'confirmed' | 'rejected' | 'failed';
export type AdPlacement = 'home' | 'history' | 'settings' | 'post_workout';
export type PhotoAngle = 'front' | 'back' | 'side_left' | 'side_right' | 'custom';
export type PreferredUnits = 'imperial' | 'metric';

export type HeightUnit = 'ft_in' | 'in' | 'cm';
export type WeightUnit = 'lb' | 'kg';
export type DistanceUnit = 'mi' | 'km';
export type MeasurementUnit = 'in' | 'cm';
export type WaterUnit = 'oz' | 'L';
export type PrivacyLevel = 'private' | 'shared' | 'public';

/** Base fields present on all persisted entities */
export type BaseEntity = {
  id: string;
  createdAt: string;
};

/** Paginated API response wrapper */
export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

/** Standard service result */
export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

/** Research citation attached to AI recommendations */
export type ResearchCitation = {
  title: string;
  authors?: string;
  journal?: string;
  year?: number;
  url?: string;
  doi?: string;
};
